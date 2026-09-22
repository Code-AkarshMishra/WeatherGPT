"""User role personas from the MERN UI — shapes tone and follow-ups."""
from enum import Enum
from typing import Optional

# ROLE_CONFIG (variables, indicators, safety) lives in role_config.py so prompts
# are not eight unrelated hard-coded essays. Snippets below stay as short
# persona reminders; the pipeline injects the structured context.


class UserRole(str, Enum):
    CITIZEN = "citizen"
    FARMER = "farmer"
    RESEARCHER = "researcher"
    AVIATION = "aviation"
    MARINE = "marine"
    CLIMATE_ANALYST = "climate_analyst"
    URBAN_PLANNER = "urban_planner"
    AIR_QUALITY = "air_quality"
    FLOOD_DISASTER = "flood_disaster"


ROLE_SYSTEM_SNIPPETS: dict[UserRole, str] = {
    UserRole.CITIZEN: (
        "User role: Citizen. Answer for daily life — commute, umbrella, heat comfort, "
        "outdoor plans, school/office timing. Keep tips practical. For go/stay decisions, "
        "condition advice on rain/wind timing and how long the person will be outdoors; "
        "avoid absolute 'definitely go / definitely cancel' without those caveats."
    ),
    UserRole.FARMER: (
        "User role: Farmer / crop advisory. Focus on irrigation, harvest, spraying windows, "
        "drainage, and heat stress. For harvest/spray/irrigate decisions: give a conditional "
        "recommendation based on forecast rain amount, wind, and timing — never a blanket yes/no. "
        "Explicitly note that advice depends on crop type, maturity, lodging/shattering risk, "
        "whether work can finish today, and whether produce can be dried and stored safely. "
        "If crop details are missing, state assumptions and ask one short clarifying question. "
        "No medical prescriptions."
    ),
    UserRole.RESEARCHER: (
        "User role: Researcher. Prefer precise wording with brief uncertainty. You may include "
        "one or two key numbers and a short source note. Avoid absolute action mandates; "
        "frame conclusions as evidence-based and conditional on data quality."
    ),
    UserRole.AVIATION: (
        "User role: Aviation. Focus on visibility, wind, storms, ceiling, crosswind risk, "
        "and flight planning windows. Use safety-first language. Do NOT issue absolute "
        "go/no-go for flights without aircraft category / airport / operator rules — give "
        "weather-risk framing and what to verify with official METAR/TAF and ops."
    ),
    UserRole.MARINE: (
        "User role: Marine. Focus on wind, sea-state implications, squalls, coastal visibility, "
        "and sailing/fishing windows. Prefer conditional guidance (craft size, distance offshore, "
        "crew experience). Avoid absolute go/no-go unless weather clearly unsafe for small craft "
        "in general, and still state the caveat."
    ),
    UserRole.CLIMATE_ANALYST: (
        "User role: Climate analyst. Connect the short forecast to longer context or normals when asked; "
        "do not confuse day-to-day weather with climate change unless the user asks. "
        "Keep conclusions conditional and note data/period limitations."
    ),
    UserRole.URBAN_PLANNER: (
        "User role: Urban planner. Focus on heat islands, drainage/waterlogging periods, "
        "public-event timing, and infrastructure stress from heat or rain. Event/site advice "
        "must be conditional on drainage capacity, crowd size, and event duration — not a "
        "blanket cancel/proceed."
    ),
    UserRole.AIR_QUALITY: (
        "User role: Air quality. Focus on ventilation, outdoor exercise timing, smoke/dust risk "
        "after dry spells, and when still/humid air may worsen discomfort. Advice must be "
        "conditional (sensitive groups vs general public). Avoid medical diagnosis or treatment."
    ),
    UserRole.FLOOD_DISASTER: (
        "User role: Flood & Disaster. Answer what disaster-related hazards are developing, "
        "not a generic weather summary. Use only the NWP Hazard Assessment numbers. "
        "Distinguish Official warning vs WeatherGPT NWP assessment vs advisory. "
        "Never claim a flood or cyclone will occur, never invent official warnings, "
        "never order evacuations, never use fake confidence percentages."
    ),
}


ROLE_FOLLOW_UPS: dict[UserRole, list[str]] = {
    UserRole.CITIZEN: [
        "Should I carry an umbrella when leaving for work tomorrow in {place}?",
        "Will it be too hot for an evening walk in {place}?",
        "Any weather alerts I should know about in {place}?",
    ],
    UserRole.FARMER: [
        "Is tomorrow a good day to irrigate fields near {place}?",
        "When is the next safe window for pesticide spraying in {place}?",
        "Could heavy rain affect harvested crop in {place} this week?",
    ],
    UserRole.RESEARCHER: [
        "How does this week compare to the monthly normal in {place}?",
        "Show the daily rain totals for {place} over the next 7 days.",
        "Is today's temperature unusual for {place}?",
    ],
    UserRole.AVIATION: [
        "Will visibility or wind affect morning flights near {place}?",
        "Are thunderstorms expected during peak hours near {place}?",
        "What is the 24-hour wind trend near {place}?",
    ],
    UserRole.MARINE: [
        "Are squalls or strong winds expected off the coast near {place}?",
        "Is it safe for small boats near {place} tomorrow?",
        "When is the calmest window this week near {place}?",
    ],
    UserRole.CLIMATE_ANALYST: [
        "What is the temperature trend for {place} over the next week?",
        "How does rainfall this week compare to the September normal in {place}?",
        "Any anomaly signals for {place} right now?",
    ],
    UserRole.URBAN_PLANNER: [
        "Which days pose waterlogging risk for {place} this week?",
        "When will heat stress peak for outdoor workers in {place}?",
        "Is this week suitable for scheduling a large outdoor event in {place}?",
    ],
    UserRole.AIR_QUALITY: [
        "When is the best time for outdoor exercise in {place} this week?",
        "Will humidity and heat make air feel worse in {place} tomorrow?",
        "Are stagnant conditions expected in {place}?",
    ],
    UserRole.FLOOD_DISASTER: [
        "What disaster-related hazards are developing in {place} over the next 24 hours?",
        "Do GFS and ECMWF agree on rainfall risk in {place}?",
        "Is any official warning available for {place} right now?",
    ],
}


def normalize_role(value: Optional[str]) -> UserRole:
    if not value:
        return UserRole.CITIZEN
    clean = (
        value.lower()
        .strip()
        .replace("&", "and")
        .replace("-", "_")
        .replace("/", "_")
        .replace(" ", "_")
    )
    while "__" in clean:
        clean = clean.replace("__", "_")
    aliases = {
        "crop_advisory": UserRole.FARMER,
        "farmer_crop_advisory": UserRole.FARMER,
        "farmer_and_crop_advisory": UserRole.FARMER,
        "urban": UserRole.URBAN_PLANNER,
        "urbanplanner": UserRole.URBAN_PLANNER,
        "climate": UserRole.CLIMATE_ANALYST,
        "climateanalyst": UserRole.CLIMATE_ANALYST,
        "airquality": UserRole.AIR_QUALITY,
        "aqi": UserRole.AIR_QUALITY,
        "flood_disaster": UserRole.FLOOD_DISASTER,
        "flood_and_disaster": UserRole.FLOOD_DISASTER,
        "floodanddisaster": UserRole.FLOOD_DISASTER,
        "disaster": UserRole.FLOOD_DISASTER,
        "disaster_manager": UserRole.FLOOD_DISASTER,
        "flood": UserRole.FLOOD_DISASTER,
    }
    if clean in aliases:
        return aliases[clean]
    try:
        return UserRole(clean)
    except ValueError:
        return UserRole.CITIZEN


def role_advisory_domain(role: UserRole) -> str:
    mapping = {
        UserRole.FARMER: "agriculture",
        UserRole.AVIATION: "travel",
        UserRole.MARINE: "travel",
        UserRole.URBAN_PLANNER: "urban_general",
        UserRole.AIR_QUALITY: "urban_general",
        UserRole.CITIZEN: "urban_general",
        UserRole.RESEARCHER: "urban_general",
        UserRole.CLIMATE_ANALYST: "urban_general",
        UserRole.FLOOD_DISASTER: "disaster",
    }
    return mapping.get(role, "urban_general")
