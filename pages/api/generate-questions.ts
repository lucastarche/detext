import { NextApiRequest, NextApiResponse } from 'next';

interface ErrorResponse {
  error: string;
  details?: string;
}

interface SuccessResponse {
  questions: string[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length < 30) {
    return res.status(400).json({ error: 'Invalid input', details: 'Text is required and must be at least 30 characters' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error', details: 'API key is missing' });
    }

    // Call Gemini API with the correct model from the available models list
    const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=' + apiKey, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Based on the following text, generate exactly 3 insightful questions that would help someone understand the key concepts better. Each question should start with "Q: " and be on a new line. Don't include answers or any other text.\n\nText: ${text}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800,
        },
      }),
    });

    // Log response status for debugging
    console.log('Gemini API response status:', response.status);

    if (!response.ok) {
      // Try to get more detailed error information
      try {
        const errorData = await response.json();
        return res.status(response.status).json({
          error: 'Gemini API error',
          details: JSON.stringify(errorData)
        });
      } catch (e) {
        console.error(e);
        return res.status(response.status).json({
          error: 'Gemini API error',
          details: `Status ${response.status} - ${response.statusText}`
        });
      }
    }

    const data = await response.json();

    // Extract questions from the response
    let questions: string[] = [];

    if (data.candidates && data.candidates[0]?.content?.parts) {
      const responseText = data.candidates[0].content.parts[0].text;

      // Extract questions with the "Q: " prefix
      questions = responseText
        .split('\n')
        .filter((line: string) => line.trim().startsWith('Q:'))
        .map((line: string) => line.trim().replace(/^Q:\s*/, ''))
        .filter(Boolean);
    }

    // Ensure we have exactly 3 questions, or pad if fewer
    while (questions.length < 3) {
      questions.push('What is the main idea of this text?');
    }

    // Limit to 3 questions if we have more
    questions = questions.slice(0, 3);

    return res.status(200).json({ questions });
  } catch (error) {
    console.error('Error generating questions:', error);
    return res.status(500).json({
      error: 'Failed to generate questions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 