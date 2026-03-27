import { getSyntaxFile, listSyntaxTopics } from './syntax-loader';

/** Returns the Anthropic tool schema for the td_syntax tool */
export function getSyntaxToolDefinition(): Record<string, unknown> {
  return {
    name: 'td_syntax',
    description:
      'Look up Teradata SQL syntax reference. Returns detailed syntax docs with examples and constraints. Use this when you need to verify or look up specific Teradata SQL syntax, functions, or best practices.',
    input_schema: {
      type: 'object',
      properties: {
        topics: {
          type: 'array',
          items: { type: 'string' },
          description:
            'List of syntax topic names to retrieve (e.g., ["window-functions", "merge-statement"]). Use the topic names from the syntax index provided in your system prompt.',
        },
      },
      required: ['topics'],
    },
  };
}

/** Execute the td_syntax tool — returns concatenated content for requested topics */
export function executeSyntaxTool(input: { topics: string[] }): string {
  const topics = input.topics ?? [];
  if (topics.length === 0) {
    const available = listSyntaxTopics();
    return `No topics requested. Available topics:\n${available.join(', ')}`;
  }

  const results: string[] = [];
  for (const topic of topics) {
    const content = getSyntaxFile(topic);
    if (content) {
      results.push(content);
    } else {
      const available = listSyntaxTopics();
      results.push(
        `Topic "${topic}" not found. Available topics:\n${available.join(', ')}`
      );
    }
  }
  return results.join('\n\n---\n\n');
}
