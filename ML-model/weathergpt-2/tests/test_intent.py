from app.services.intent import classify_intent


def test_seven_day_forecast_is_forecast_intent():
    assert classify_intent("How will the weather be for the next 7 days in Lucknow?") == "forecast"


def test_next_week_is_forecast():
    assert classify_intent("weather forecast for next week in Delhi") == "forecast"


def test_bare_weather_in_city_is_current():
    assert classify_intent("What is the weather in Pune?") == "current_weather"


def test_farmer_advisory_intent():
    assert classify_intent("Should farmers spray pesticide today in Lucknow?") == "advisory_request"
