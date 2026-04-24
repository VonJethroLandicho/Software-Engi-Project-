import os
from google import genai
from google.genai import types

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
            )
        )
        return response.text
    except Exception as e:
        print(f"AI Generation Error: {e}")
        return "{}"