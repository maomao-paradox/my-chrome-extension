export function getFormattedDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

export function buildConfig(tools:any[]) {
  const systemInstruction = [
    'You are an assistant embedded in a browser tab.',
    'User prompts typically refer to the current tab unless stated otherwise.',
    'Use the provided tools to query page content when you need it.',
    `Today's date is: ${getFormattedDate()}`,
    'CRITICAL RULE: Whenever the user provides a relative date (e.g., "next Monday", "tomorrow", "in 3 days"), you must calculate the exact calendar date based on today\'s date.',
    'CRITICAL RULE: Do not try to use other tools than the available ones.',
  ];
  const functionDeclarations = tools.map((tool) => ({
    name: `_${tool.frameId}_${tool.name}`,
    description: tool.description,
    parametersJsonSchema: tool.inputSchema
      ? JSON.parse(tool.inputSchema)
      : { type: 'object', properties: {} },
  }));
  return { systemInstruction, tools: [{ functionDeclarations }] };
}