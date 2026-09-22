"""NOAA GHCN-Daily observational downloader (station-filtered, not full globe).

Downloads station metadata + inventory, filters by country/bbox/coverage,
then fetches per-station CSV.GZ from by_station/ — preserving quality flags.
"""
from __future__ import annotations

import csv
import gzip
import io
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import httpx

from ml_data_pipeline import (
    GHCN_BY_STATION_URL,
    GHCN_COUNTRIES_URL,
    GHCN_INVENTORY_URL,
    GHCN_STATIONS_URL,
    RAW_ROOT,
    write_metadata,
)


def ghcn_dir() -> Path:
    return RAW_ROOT / "ghcn"


def download_text(client: httpx.Client, url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    response = client.get(url)
    response.raise_for_status()
    dest.write_bytes(response.content)
    return dest


def parse_stations(path: Path) -> list[dict[str, Any]]:
    """Fixed-width ghcnd-stations.txt."""
    stations: list[dict[str, Any]] = []
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            if len(line) < 85:
                continue
            stations.append(
                {
                    "station_id": line[0:11].strip(),
                    "latitude": float(line[12:20]),
                    "longitude": float(line[21:30]),
                    "elevation_m": _float_or_none(line[31:37]),
                    "state": line[38:40].strip(),
                    "name": line[41:71].strip(),
                    "gsn_flag": line[72:75].strip(),
                    "hcn_crn_flag": line[76:79].strip(),
                    "wmo_id": line[80:85].strip(),
                    "country": line[0:2],
                }
            )
    return stations


def parse_inventory(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            if len(line) < 45:
                continue
            rows.append(
                {
                    "station_id": line[0:11].strip(),
                    "latitude": float(line[12:20]),
                    "longitude": float(line[21:30]),
                    "element": line[31:35].strip(),
                    "first_year": int(line[36:40]),
                    "last_year": int(line[41:45]),
                }
            )
    return rows


def _float_or_none(text: str) -> Optional[float]:
    text = text.strip()
    if not text or text == "-999.9":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def filter_stations(
    stations: list[dict[str, Any]],
    inventory: list[dict[str, Any]],
    *,
    countries: Optional[list[str]] = None,
    bbox: Optional[dict[str, float]] = None,
    elements: Optional[list[str]] = None,
    start_year: Optional[int] = None,
    end_year: Optional[int] = None,
    min_years_coverage: int = 1,
    max_stations: Optional[int] = None,
) -> list[dict[str, Any]]:
    elements = elements or ["PRCP"]
    countries = [c.upper() for c in (countries or [])]

    inv_by_station: dict[str, list[dict[str, Any]]] = {}
    for row in inventory:
        if row["element"] not in elements:
            continue
        inv_by_station.setdefault(row["station_id"], []).append(row)

    selected: list[dict[str, Any]] = []
    for st in stations:
        if countries and st["country"] not in countries:
            continue
        if bbox:
            if not (
                bbox["min_lat"] <= st["latitude"] <= bbox["max_lat"]
                and bbox["min_lon"] <= st["longitude"] <= bbox["max_lon"]
            ):
                continue
        inv_rows = inv_by_station.get(st["station_id"]) or []
        if not inv_rows:
            continue
        ok = False
        coverage_years = 0
        last_year_seen = 0
        for inv in inv_rows:
            first, last = inv["first_year"], inv["last_year"]
            last_year_seen = max(last_year_seen, last)
            if start_year is not None and last < start_year:
                continue
            if end_year is not None and first > end_year:
                continue
            span_start = max(first, start_year or first)
            span_end = min(last, end_year or last)
            years = max(0, span_end - span_start + 1)
            coverage_years = max(coverage_years, years)
            if years >= min_years_coverage:
                ok = True
        if not ok:
            continue
        selected.append(
            {
                **st,
                "elements": elements,
                "coverage_years_est": coverage_years,
                "inventory_last_year": last_year_seen,
            }
        )

    selected.sort(
        key=lambda s: (
            -s.get("inventory_last_year", 0),
            -s.get("coverage_years_est", 0),
            s.get("gsn_flag") != "GSN",
            s["station_id"],
        )
    )
    if max_stations is not None:
        selected = selected[:max_stations]
    return selected


def parse_by_station_csv_text(
    text: str,
    *,
    elements: list[str],
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    station_meta: Optional[dict[str, Any]] = None,
) -> list[dict[str, Any]]:
    """Parse NCEI by_station CSV text.

    Official files have NO header row. Columns (readme-by_station.txt):
    ID, DATE(YYYYMMDD), ELEMENT, VALUE, MFLAG, QFLAG, SFLAG, OBS-TIME
    """
    rows: list[dict[str, Any]] = []
    fieldnames = ["ID", "DATE", "ELEMENT", "VALUE", "MFLAG", "QFLAG", "SFLAG", "OBSTIME"]
    reader = csv.DictReader(io.StringIO(text), fieldnames=fieldnames)
    for rec in reader:
        # Skip accidental header if present
        if (rec.get("ID") or "").strip().upper() == "ID":
            continue
        element = (rec.get("ELEMENT") or "").strip()
        if element not in elements:
            continue
        date_s = (rec.get("DATE") or "").strip()
        if start_date and date_s < start_date.replace("-", ""):
            continue
        if end_date and date_s > end_date.replace("-", ""):
            continue
        raw_val = rec.get("VALUE")
        try:
            value_raw = int(raw_val) if raw_val not in (None, "") else None
        except ValueError:
            value_raw = None
        value_converted = None
        unit = None
        if value_raw is not None:
            if element == "PRCP":
                value_converted = value_raw / 10.0
                unit = "mm"
            elif element in {"TMAX", "TMIN", "TAVG"}:
                value_converted = value_raw / 10.0
                unit = "°C"
            else:
                value_converted = float(value_raw)
                unit = "raw_ghcn_units"

        out = {
            "station_id": (rec.get("ID") or "").strip(),
            "date": f"{date_s[0:4]}-{date_s[4:6]}-{date_s[6:8]}" if len(date_s) == 8 else date_s,
            "element": element,
            "value_raw": value_raw,
            "value": value_converted,
            "unit": unit,
            "mflag": (rec.get("MFLAG") or "").strip(),
            "qflag": (rec.get("QFLAG") or "").strip(),
            "sflag": (rec.get("SFLAG") or "").strip(),
            "obstime": (rec.get("OBSTIME") or "").strip(),
            "source": "NOAA_GHCN_Daily",
            "endpoint": GHCN_BY_STATION_URL,
        }
        if station_meta:
            out["latitude"] = station_meta.get("latitude")
            out["longitude"] = station_meta.get("longitude")
            out["station_name"] = station_meta.get("name")
            out["elevation_m"] = station_meta.get("elevation_m")
            out["country"] = station_meta.get("country")
        rows.append(out)
    return rows


def _read_station_file(path: Path) -> str:
    if str(path).endswith(".gz"):
        with gzip.open(path, "rt", encoding="utf-8", errors="replace") as f:
            return f.read()
    return path.read_text(encoding="utf-8", errors="replace")


def download_ghcn(
    *,
    countries: Optional[list[str]],
    bbox: Optional[dict[str, float]],
    elements: list[str],
    start_date: str,
    end_date: str,
    min_years_coverage: int = 1,
    max_stations: Optional[int] = None,
    timeout: float = 120.0,
    sleep_s: float = 0.3,
    force_refresh_meta: bool = False,
) -> dict[str, Any]:
    out_dir = ghcn_dir()
    out_dir.mkdir(parents=True, exist_ok=True)
    meta_dir = out_dir / "metadata"
    meta_dir.mkdir(parents=True, exist_ok=True)

    stations_path = meta_dir / "ghcnd-stations.txt"
    inventory_path = meta_dir / "ghcnd-inventory.txt"
    countries_path = meta_dir / "ghcnd-countries.txt"

    start_year = int(start_date[:4])
    end_year = int(end_date[:4])

    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        if force_refresh_meta:
            for p in (stations_path, inventory_path, countries_path):
                if p.exists():
                    p.unlink()
        download_text(client, GHCN_STATIONS_URL, stations_path)
        download_text(client, GHCN_INVENTORY_URL, inventory_path)
        download_text(client, GHCN_COUNTRIES_URL, countries_path)

        stations = parse_stations(stations_path)
        inventory = parse_inventory(inventory_path)
        selected = filter_stations(
            stations,
            inventory,
            countries=countries,
            bbox=bbox,
            elements=elements,
            start_year=start_year,
            end_year=end_year,
            min_years_coverage=min_years_coverage,
            max_stations=max_stations,
        )

        write_metadata(
            meta_dir / "selected_stations.json",
            source="NOAA GHCN-Daily",
            stations_url=GHCN_STATIONS_URL,
            inventory_url=GHCN_INVENTORY_URL,
            filter={
                "countries": countries,
                "bbox": bbox,
                "elements": elements,
                "start_date": start_date,
                "end_date": end_date,
                "min_years_coverage": min_years_coverage,
                "max_stations": max_stations,
            },
            station_count=len(selected),
            stations=selected,
        )

        all_rows: list[dict[str, Any]] = []
        station_reports: list[dict[str, Any]] = []
        station_files_dir = out_dir / "by_station"
        station_files_dir.mkdir(parents=True, exist_ok=True)

        for st in selected:
            sid = st["station_id"]
            url = f"{GHCN_BY_STATION_URL}/{sid}.csv.gz"
            dest = station_files_dir / f"{sid}.csv.gz"
            try:
                if not dest.exists() or dest.stat().st_size == 0:
                    response = client.get(url)
                    response.raise_for_status()
                    dest.write_bytes(response.content)
                text = _read_station_file(dest)
                rows = parse_by_station_csv_text(
                    text,
                    elements=elements,
                    start_date=start_date,
                    end_date=end_date,
                    station_meta=st,
                )
                all_rows.extend(rows)
                station_reports.append(
                    {
                        "station_id": sid,
                        "ok": True,
                        "rows_in_range": len(rows),
                        "file": str(dest),
                        "url": url,
                    }
                )
            except Exception as exc:  # noqa: BLE001
                station_reports.append({"station_id": sid, "ok": False, "error": str(exc), "url": url})
            time.sleep(sleep_s)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    combined = out_dir / f"ghcn_{'-'.join(elements)}_{start_date}_{end_date}_{stamp}.csv"
    fieldnames = [
        "station_id",
        "date",
        "latitude",
        "longitude",
        "station_name",
        "elevation_m",
        "country",
        "element",
        "value_raw",
        "value",
        "unit",
        "mflag",
        "qflag",
        "sflag",
        "obstime",
        "source",
        "endpoint",
    ]
    with open(combined, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_rows)

    meta_path = combined.with_suffix(".metadata.json")
    write_metadata(
        meta_path,
        source="NOAA GHCN-Daily",
        api_endpoint=GHCN_BY_STATION_URL,
        documentation="https://www.ncei.noaa.gov/pub/data/ghcn/daily/readme.txt",
        stations_url=GHCN_STATIONS_URL,
        inventory_url=GHCN_INVENTORY_URL,
        variables=elements,
        units={"PRCP": "mm (converted from tenths of mm)", "value_raw": "native GHCN integer"},
        geographic_coverage={"countries": countries, "bbox": bbox},
        date_range={"start": start_date, "end": end_date},
        quality_flags_preserved=["mflag", "qflag", "sflag", "obstime"],
        output_csv=str(combined),
        row_count=len(all_rows),
        station_count=len(selected),
        station_reports=station_reports,
        parameters={
            "min_years_coverage": min_years_coverage,
            "max_stations": max_stations,
            "station_file_format": "csv.gz",
        },
    )

    return {
        "combined_csv": str(combined),
        "metadata": str(meta_path),
        "row_count": len(all_rows),
        "station_count": len(selected),
        "stations_ok": sum(1 for r in station_reports if r.get("ok")),
        "selected_stations": selected,
        "station_reports": station_reports,
    }
