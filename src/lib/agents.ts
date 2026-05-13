import { ai } from './gemini';
import { Type } from '@google/genai';

export type AgentRole = 'search' | 'scraper' | 'review' | 'positioning';

export async function runOrchestrator(idea: string): Promise<{
    target: string;
    competitors: string;
    dimensions: string;
    feedback: string;
}> {
    const prompt = `You are the Setup Orchestrator for an AI research team.
The user wants to analyze a product or market, they might only have a rough idea, or they might paste a detailed functional spec.

USER INPUT:
"""
${idea}
"""

YOUR TASK:
1. Extract or formulate a concise 'Target Product Concept' based on their input.
2. Search your knowledge and infer 3-5 real-world competitors matching this niche. (e.g. if it's an AI digital pet, consider Peridot, Replika, etc).
3. Identify 4-5 key dimensions to analyze that make sense for this specific product (e.g., Pricing, Core Interaction Loop, App Store Reviews, Image/Video Generation Quality).
4. Provide 'feedback' to the user:
   - If their idea is vague, ask them useful clarifying questions to flesh it out (反问用户).
   - Summarize briefly why you chose these competitors.
   - If they provided a detailed document, just acknowledge the depth and explain the research angle.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.1-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        target: { type: Type.STRING },
                        competitors: { type: Type.STRING },
                        dimensions: { type: Type.STRING },
                        feedback: { type: Type.STRING }
                    },
                    required: ["target", "competitors", "dimensions", "feedback"]
                }
            }
        });

        let text = response.text || "{}";
        return JSON.parse(text);
    } catch (err: any) {
        console.error("Orchestrator error:", err);
        throw err;
    }
}


export async function runAgent(
  role: AgentRole,
  target: string,
  competitors: string,
  dimensions: string,
  onProgress: (text: string) => void
): Promise<string> {
  const model = "gemini-3.1-pro-preview";
  let systemInstruction = "";
  let prompt = "";

  switch (role) {
    case 'search':
      systemInstruction = `You are a Search Agent for a digital research team. Your goal is to gather the most recent news, official announcements, and market updates about the target product and its competitors. You MUST use the googleSearch tool.`;
      prompt = `Use googleSearch to gather recent news, market trends, and updates for the product concept: "${target}". 
Also explicitly search for its competitors: "${competitors}".
Focus on these dimensions: "${dimensions}".
Output a highly structured summary of what you found.`;
      break;
    case 'scraper':
      systemInstruction = `You are a Scraper Agent. Your task is to extract core features, pricing structures, and detailed website copy from the target product and competitors. You MUST use the googleSearch tool to locate official sites, feature lists, and pricing pages.`;
      prompt = `Use googleSearch to find detailed feature lists, pricing, and official feature descriptions for "${target}".
Also compare with competitors: "${competitors}".
Focus on these dimensions: "${dimensions}".
Output a structured summary of features and pricing based on the search results.`;
      break;
    case 'review':
      systemInstruction = `You are a Review & Sentiment Analysis Agent. Your task is to analyze user feedback. You MUST use the googleSearch tool with targeted queries (e.g., 'site:reddit.com', 'site:apps.apple.com', or 'site:twitter.com') to find real user voices, App Store reviews, and Reddit discussions.`;
      prompt = `Use googleSearch to analyze user reviews, common complaints, praised features, and reddit/twitter discussions for "${target}" and similar products.
Include comparisons with competitors: "${competitors}".
Focus on these dimensions: "${dimensions}".
Output a structured summary of user pain points, delights, and recurring feedback.`;
      break;
    case 'positioning':
      systemInstruction = `You are a Positioning & Strategy Agent. Your task is to analyze the market positioning, target audience, and go-to-market strategy. You MUST use the googleSearch tool to uncover how these companies pitch themselves, their slogans, and marketing angles.`;
      prompt = `Use googleSearch to analyze the target audience, market positioning, unique value propositions, and marketing narrative for "${target}".
Also contrast this with its competitors: "${competitors}".
Focus on these dimensions: "${dimensions}".
Output a structured report on their strategic positioning.`;
      break;
  }

  onProgress("Initializing + preparing search queries...");
  
  try {
    const chat = ai.chats.create({
        model,
        config: {
            systemInstruction,
            tools: [{ googleSearch: {} }],
        }
    });

    const stream = await chat.sendMessageStream({ message: prompt });
    let fullText = "";
    for await (const chunk of stream) {
        fullText += (chunk as any).text || "";
        onProgress(fullText);
    }
    return fullText;
  } catch (err: any) {
    console.error(`Error in ${role} agent:`, err);
    throw err;
  }
}

export async function runSynthesis(
    target: string,
    inputs: Record<AgentRole, string>,
    onProgress: (text: string) => void
): Promise<string> {
   const prompt = `You are the final Synthesis Agent for a competitive analysis report on "${target}".
Here is the data gathered by the 4 specialized agents:

1. Search Agent (News & Market News):
${inputs.search}

2. Scraper Agent (Features & Pricing):
${inputs.scraper}

3. Review Agent (User Sentiment):
${inputs.review}

4. Positioning Agent (Market Strategy):
${inputs.positioning}

Please synthesize this into a structured Markdown report.
Requirements:
1. Start with an executive summary.
2. Include a Markdown table comparing the target with competitors based on the gathered data.
3. Organize clearly using headings (H2, H3).
4. Emphasize user pain points, sentiment, and strategic opportunity areas (Product Opportunities).
5. Output purely the markdown content.
`;

  onProgress("Starting synthesis formatting...");
  
  try {
      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
            systemInstruction: "You are an expert product manager orchestrating competitive intelligence.",
        }
      });

      let fullText = "";
      for await (const chunk of responseStream) {
          fullText += (chunk as any).text || "";
          onProgress(fullText);
      }

      return fullText;
  } catch (err: any) {
      console.error(`Error in synthesis agent:`, err);
      throw err;
  }

}
