"""Historical climate analysis and NWP previous-run verification APIs."""
from fastapi import APIRouter, HTTPException

from app.models.historical import HistoricalAnalysisRequest, NwpVerificationRequest
from app.services.forecast_grounding import resolve_coordinates
from app.services.historical_analysis import (
    compare_locations,
    parse_period,
    resolve_named_places,
    run_historical_query,
)
from app.services.nwp_verification import verify_models

router = APIRouter()


def _coords(request) -> tuple[float | None, float | None, str | None]:
    lat = getattr(request, "latitude", None)
    lon = getattr(request, "longitude", None)
    name = None
    loc = getattr(request, "location", None)
    if loc is not None:
        lat = lat if lat is not None else loc.lat
        lon = lon if lon is not None else loc.lon
        name = loc.name
    if (lat is None or lon is None) and name:
        resolved = resolve_coordinates(name, client_name=name)
        lat = resolved.get("lat")
        lon = resolved.get("lon")
        name = resolved.get("name") or name
    return lat, lon, name


@router.post("/climate/historical-analysis")
def historical_analysis(request: HistoricalAnalysisRequest) -> dict:
    message = request.message or "last 1 year"
    if request.start_date and request.end_date:
        message = f"{request.start_date} to {request.end_date} {message}"
    names = list(request.locations or [])
    if names:
        period = parse_period(message)
        if not period.get("available"):
            raise HTTPException(status_code=422, detail=period.get("error"))
        places, failed = resolve_named_places(names)
        if not places:
            return {
                "available": False,
                "error": "Could not resolve any requested locations. Do not guess.",
                "failed_locations": failed,
            }
        compared = compare_locations(places, period["start"], period["end"])
        compared["failed_locations"] = failed
        compared["period"] = {
            "start": period["start"],
            "end": period["end"],
            "label": period.get("label"),
            "classification": period.get("classification"),
        }
        compared["mode"] = "multi_city"
        if request.include_verification and places:
            compared["nwp_verification"] = verify_models(
                places[0]["latitude"],
                places[0]["longitude"],
                period["start"],
                period["end"],
                location_name=places[0]["name"],
            )
        return compared

    lat, lon, name = _coords(request)
    if lat is None or lon is None:
        # allow message to carry city names
        result = run_historical_query(
            message,
            include_verification=request.include_verification,
        )
        if not result.get("available") and "Location not resolved" in str(result.get("error")):
            raise HTTPException(
                status_code=422,
                detail="latitude and longitude or location.name are required; do not guess.",
            )
        return result
    result = run_historical_query(
        message,
        latitude=float(lat),
        longitude=float(lon),
        location_name=name,
        include_verification=request.include_verification,
    )
    return result


@router.post("/climate/nwp-verification")
def nwp_verification(request: NwpVerificationRequest) -> dict:
    lat, lon, name = _coords(request)
    message = request.message or "last 90 days"
    if request.start_date and request.end_date:
        period = {
            "available": True,
            "start": request.start_date,
            "end": request.end_date,
        }
    else:
        period = parse_period(message)
    if not period.get("available"):
        raise HTTPException(status_code=422, detail=period.get("error"))
    if lat is None or lon is None:
        if name:
            resolved = resolve_coordinates(name, client_name=name)
            lat, lon = resolved.get("lat"), resolved.get("lon")
            name = resolved.get("name") or name
    if lat is None or lon is None:
        raise HTTPException(
            status_code=422,
            detail="Coordinates required for NWP verification. Do not guess a location.",
        )
    return verify_models(
        float(lat),
        float(lon),
        period["start"],
        period["end"],
        location_name=name,
    )
