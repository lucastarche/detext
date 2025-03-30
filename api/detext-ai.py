# /api/analyze_vowels.py

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
import os

# Vercel expects an ASGI application instance, typically named 'app'
app = FastAPI()

# Define the POST route at the root ('/') relative to the file path.
# So, this function will handle POST requests to /api/analyze_vowels
@app.post("/")
async def count_vowels(request: Request):
    """
    Accepts plain text (text/plain) via POST request body,
    counts the frequency of vowels (a, e, i, o, u, case-insensitive),
    and returns the counts as a JSON object.
    """
    # 1. Check Content-Type header
    content_type = request.headers.get("content-type")
    if not content_type or not content_type.startswith("text/plain"):
        raise HTTPException(
            status_code=415, # Unsupported Media Type
            detail="Unsupported Media Type. Please send plain text using 'Content-Type: text/plain'."
        )

    # 2. Read the raw request body
    try:
        body_bytes = await request.body()
        text = body_bytes.decode("utf-8") # Assume UTF-8 encoding
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400, # Bad Request
            detail="Could not decode text using UTF-8. Ensure valid encoding."
        )
    except Exception as e:
         # Catch potential errors during body reading
         raise HTTPException(
            status_code=500,
            detail=f"Error reading request body: {str(e)}"
         )

    # 3. Perform the vowel counting logic
    vowel_counts = {'a': 0, 'e': 0, 'i': 0, 'o': 0, 'u': 0}
    vowels = "aeiou"

    for char in text.lower(): # Process in lowercase for case-insensitivity
        if char in vowels:
            vowel_counts[char] += 1

    # 4. Return the result as JSON
    #    FastAPI automatically handles dict -> JSON conversion,
    #    but using JSONResponse gives slightly more control if needed.
    return JSONResponse(content=vowel_counts)