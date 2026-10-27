const printResult = (p: any) => {
  const { message } = p;
  if (!message.length) {
    return "ERROR: `message` must be a non-empty string.";
  }
  alert("工具调用结果为：" + message);
  return "SUCCESS: printResult executed successfully.";
};

const coculate = (p: any) => {
  const { a, b } = p;
  if (typeof a !== "number" || typeof b !== "number") {
    return "ERROR: `a` and `b` must be numbers.";
  }
  return (a + b) ** (a - b);
};

if (
  !document.modelContext ||
  typeof document.modelContext.registerTool !== "function"
) {
  console.warn("当前浏览器不支持 WebMCP registerTool API");
} else {
  const printResultTool = {
    execute: printResult,
    name: "printResult",
    description: "Prints the result of a tool execution.",
    inputSchema: {
      type: "object",
      description:
        "The output of the printResult tool is a string that describes the result.",
      properties: {
        message: {
          type: "string",
          description: "The message to display.",
        },
      },
      required: ["message"],
    },
    outputSchema: {
      type: "string",
      description:
        "a message describing the result of the printResult tool execution, indicating success or failure.",
    },
    annotations: {
      readOnlyHint: false,
    },
  };
  document.modelContext.registerTool(printResultTool as any);

  const coculateTool = {
    execute: coculate,
    name: "coculate",
    description: "Calculates the sum of two numbers and raises it to the power of their difference.",
    inputSchema: {
      type: "object",
      description:
        "The output of the coculate tool is a number that represents the result of the calculation.",
      properties: {
        a: {
          type: "number",
          description: "The first number to add.",
        },
        b: {
          type: "number",
          description: "The second number to add.",
        },
      },
      required: ["a", "b"],
    },
    outputSchema: {
      type: "number",
      description: "a number representing the result of the calculation.",
    },
    annotations: {
      readOnlyHint: false,
    },
  };
  document.modelContext.registerTool(coculateTool as any);
}
