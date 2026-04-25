import os
import json
import re
from google import genai
from google.genai import types

def _extract_json_object(text):
    if not text:
        return "{}"

    cleaned = text.strip()

    # Remove markdown code fences if present
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    # If response contains extra text around JSON, extract first balanced object
    start = cleaned.find('{')
    if start == -1:
        return "{}"

    depth = 0
    end = -1
    for i, ch in enumerate(cleaned[start:], start=start):
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = i
                break

    if end == -1:
        return cleaned[start:]

    return cleaned[start:end + 1]

def _parse_ai_json(text):
    raw = _extract_json_object(text)
    if not raw or raw == "{}":
        return {}

    # Attempt 1: strict parse
    try:
        return json.loads(raw)
    except Exception:
        pass

    # Attempt 2: remove trailing commas in objects/arrays
    repaired = re.sub(r",\s*([}\]])", r"\1", raw)
    try:
        return json.loads(repaired)
    except Exception as e:
        print("Failed to parse AI JSON:", e)
        return {}

def generate_report_analysis(report_data_json):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Missing Gemini API Key.")
        return "{}"
    
    try:
        client = genai.Client(api_key=api_key)
        
        prompt = f"""
        You are an expert business analyst for Mugshot Barbershop.
        Analyze the following JSON data representing barbershop performance over a specific time frame.

        DATA:
        {report_data_json}

        REQUIREMENTS:
        You MUST return a valid JSON object (do not include markdown blocks like ```json). 
        The JSON object must have exactly these keys. The values should be a 4-5 sentence insightful analysis and actionable business recommendation for each metric based on the data:
        {{
            "trend_analysis": "...",
            "barber_analysis": "...",
            "walkin_vs_appt_analysis": "...",
            "peak_hours_analysis": "...",
            "service_distribution_analysis": "..."
        }}
        """
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            )
        )

        parsed = _parse_ai_json(response.text)

        required_keys = [
            "trend_analysis",
            "barber_analysis",
            "walkin_vs_appt_analysis",
            "peak_hours_analysis",
            "service_distribution_analysis",
        ]

        # Ensure stable response shape for frontend
        return {k: str(parsed.get(k, "")) for k in required_keys}
    except Exception as e:
        print(f"AI Generation Error: {e}")
        return {}