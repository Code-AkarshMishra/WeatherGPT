"""NWP hazard-assessment API (GFS + ECMWF via Open-Meteo)."""
from fastapi import APIRouter, HTTPException

from app.models.nwp import NwpHazardRequest, NwpHazardResponse
from app.services.flood_disaster import build_disaster_assessment, compact_disaster_for_ui
from app.services.forecast_grounding import resolve_coordinates
from app.services.nwp_hazards import assess_nwp_hazards_for_location
from app.services.roles import UserRole, normalize_role

router = APIRouter()


@router.post("/nwp/hazard-assessment", response_model=NwpHazardResponse)
def nwp_hazard_assessment(request: NwpHazardRequest) -> NwpHazardResponse:
    lat = request.latitude
    lon = request.longitude
    name = None
    if request.location is not None:
        lat = lat if lat is not None else request.location.lat
        lon = lon if lon is not None else request.location.lon
        name = request.location.name

    if lat is None or lon is None:
        if name:
            resolved = resolve_coordinates(name, client_name=name)
            lat = resolved.get("lat")
            lon = resolved.get("lon")
            name = resolved.get("name") or name
        else:
            raise HTTPException(
                status_code=422,
                detail="latitude and longitude are required (or location.name to geocode).",
            )

    if lat is None or lon is None:
        raise HTTPException(
            status_code=422,
            detail="Could not resolve location. Provide coordinates; do not guess.",
        )

    result = assess_nwp_hazards_for_location(
        latitude=float(lat),
        longitude=float(lon),
        location_name=name,
        role=request.role,
        hours=request.hours,
    )
    if normalize_role(request.role) == UserRole.FLOOD_DISASTER:
        disaster = build_disaster_assessment(
            result, location_name=name
        )
        result["disaster_assessment"] = compact_disaster_for_ui(disaster)
    if not result.get("available"):
        return NwpHazardResponse(
            available=False,
            official_warning=False,
            location=result.get("location") or {"latitude": lat, "longitude": lon, "name": name},
            error=result.get("error"),
            models=result.get("models"),
            hazards=[],
            disaster_assessment=result.get("disaster_assessment"),
        )
    return NwpHazardResponse.model_validate(result)
