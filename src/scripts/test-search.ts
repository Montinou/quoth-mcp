import 'dotenv/config';
import { searchDocuments } from '../lib/quoth/search';

const PROJECT_UUID = 'b6fc48df-f192-49ea-b9b6-f86d53c69c47';

async function testSearch() {
  console.log('Testing search with Jina embeddings + Cohere reranking...\n');

  const queries = [
    'How do I write Playwright tests for authentication?',
    'What testing patterns should I use with Vitest?',
    'How is the project architecture organized?',
    'API schema documentation',
    'coding conventions and style guide'
  ];

  for (const query of queries) {
    console.log('\n🔍 Query: "' + query + '"');
    console.log('─'.repeat(60));

    try {
      const results = await searchDocuments(query, PROJECT_UUID);

      if (results.length === 0) {
        console.log('  No results found');
        continue;
      }

      console.log('  Found ' + results.length + ' results:');
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const score = ((r.relevance || 0) * 100).toFixed(1);
        const preview = (r.snippet || '').substring(0, 100).replace(/\n/g, ' ');
        console.log('  ' + (i+1) + '. [' + score + '%] ' + (r.title || r.path));
        console.log('     Preview: ' + preview + '...');
      }
    } catch (error: any) {
      console.log('  Error: ' + error.message);
    }
  }
}

testSearch().catch(console.error);
