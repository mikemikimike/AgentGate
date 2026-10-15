import { encode, decode } from 'gpt-tokenizer';

export interface ContextOptions {
  modelMaxTokens: number;
  safetyMargin?: number;
}

export interface Step {
  tool: string;
  arguments: any;
  result: string;
  untrusted?: boolean;
}

export function escapeSentinels(text: string): string {
  // Replace <untrusted> and </untrusted> with escaped versions to prevent injection
  // Also escape structural prompt section headers like \n[ACTION], \n[TOOL], \n[GOAL], \n[STEPS]
  return text
    .replace(/<untrusted>/gi, '<\\untrusted>')
    .replace(/<\/untrusted>/gi, '<\\/untrusted>')
    .replace(/(^|\r?\n)\[(ACTION|TOOL|GOAL|STEPS)\]/g, '$1\\[$2\\]');
}

export function truncate(text: string, maxTokens: number): string {
  const tokens = encode(text);
  if (tokens.length > maxTokens) {
    const end = Math.max(0, maxTokens - 3); // Leave room for ellipsis, prevent negative slice index
    const truncatedTokens = tokens.slice(0, end);
    return decode(truncatedTokens) + "...[TRUNCATED]";
  }
  return text;
}

export function buildContext(
  goal: string,
  action: { tool: string, arguments: any },
  toolTrustLevel: string,
  history: Step[],
  options: ContextOptions
): { prompt: string, actionTruncated: boolean, promptTokens: number } {
  
  const safetyMargin = options.safetyMargin || 20;
  const questionsBlockTokens = 40; // Approx overhead for questions
  
  const budget = options.modelMaxTokens - questionsBlockTokens - safetyMargin;
  
  // Caps
  const actionCap = 120;
  const toolCap = 40;
  const goalCap = 80;
  
  let actionText = `[ACTION] ${action.tool}(${JSON.stringify(action.arguments)})`;
  let toolText = `[TOOL] ${toolTrustLevel}`;
  let goalText = `[GOAL] ${goal}`;
  
  let actionTruncated = false;
  const actionTokens = encode(actionText).length;
  if (actionTokens > actionCap) {
    actionText = truncate(actionText, actionCap);
    actionTruncated = true;
  }
  toolText = truncate(toolText, toolCap);
  goalText = truncate(goalText, goalCap);
  
  let remainingTokens = budget - (encode(actionText).length + encode(toolText).length + encode(goalText).length);
  
  const stepsRendered: string[] = [];
  
  // Newest first
  const reversedHistory = [...history].reverse();
  
  for (let i = 0; i < reversedHistory.length; i++) {
    const step = reversedHistory[i];
    let resultText = step.result;
    
    if (step.untrusted) {
      resultText = `<untrusted>${escapeSentinels(resultText)}</untrusted>`;
    }
    
    let stepText = `${reversedHistory.length - i}. ${step.tool}() -> ${resultText}`;
    const stepTokens = encode(stepText).length;
    
    if (stepTokens > remainingTokens) {
      if (remainingTokens > 5) {
        stepText = truncate(stepText, Math.floor(remainingTokens));
        stepsRendered.push(stepText);
      }
      break;
    }
    stepsRendered.push(stepText);
    remainingTokens -= stepTokens;
  }
  
  const prompt = [
    actionText,
    toolText,
    goalText,
    "[STEPS]",
    ...stepsRendered
  ].join("\n");
  
  return {
    prompt,
    actionTruncated,
    promptTokens: encode(prompt).length
  };
}
