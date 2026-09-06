@echo off
echo ========================================================
echo   WeatherGPT Unified ML Service (ML-1 + ML-2)
echo ========================================================
echo Starting FastAPI microservice on http://127.0.0.1:8000 ...
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
