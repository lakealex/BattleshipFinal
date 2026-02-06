
import { GoogleGenAI, Type } from "@google/genai";
import { GRID_SIZE } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface AIMove {
  r: number;
  c: number;
  taunt: string;
}

export const getAIGameMove = async (
  playerGridVisibleToAI: string[][],
  history: string[]
): Promise<AIMove> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `
        Current game board (Player's side):
        ${JSON.stringify(playerGridVisibleToAI)}
        
        Key: 'empty' = untouched, 'hit' = you hit a ship, 'miss' = you missed.
        
        Recent history of dialogue:
        ${history.slice(-5).join('\n')}

        Strategic rules:
        1. Pick a coordinate (r, c) between 0 and 9 that is 'empty'.
        2. If you have a 'hit' nearby, try adjacent cells to sink the ship.
        3. Be cunning.
        4. Provide a short, menacing taunt.

        Response MUST be valid JSON.
      `,
      config: {
        systemInstruction: "You are 'Admiral Obsidian', a cold, calculating, and slightly arrogant naval strategist playing a high-stakes game of Battleship. You value efficiency and despise inefficiency.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            r: { type: Type.INTEGER, description: "Row coordinate 0-9" },
            c: { type: Type.INTEGER, description: "Column coordinate 0-9" },
            taunt: { type: Type.STRING, description: "Short taunt message" },
          },
          required: ["r", "c", "taunt"],
        },
      },
    });

    const data = JSON.parse(response.text || "{}");
    
    // Validation
    if (typeof data.r !== 'number' || data.r < 0 || data.r >= GRID_SIZE || 
        typeof data.c !== 'number' || data.c < 0 || data.c >= GRID_SIZE) {
      throw new Error("Invalid AI coordinates");
    }

    return data as AIMove;
  } catch (error) {
    console.error("AI Error:", error);
    // Fallback logic
    return {
      r: Math.floor(Math.random() * GRID_SIZE),
      c: Math.floor(Math.random() * GRID_SIZE),
      taunt: "Static interference... but I am still coming for you."
    };
  }
};

export const getAITaunt = async (event: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `The player just did: ${event}. As Admiral Obsidian, give a 1-sentence reaction.`,
            config: {
                systemInstruction: "You are Admiral Obsidian, a superior naval AI. You are witty, intimidating, and hate losing."
            }
        });
        return response.text || "Intriguing move.";
    } catch {
        return "I see what you are doing.";
    }
}
