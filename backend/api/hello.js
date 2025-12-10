export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  return new Response('Hello from Edge Function!', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}