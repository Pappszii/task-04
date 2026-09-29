// Forwards /api (REST and SSE) to the server started by `npm run dev`.
export default {
  '/api': {
    target: `http://localhost:${process.env.API_PORT ?? 3000}`,
    secure: false,
  },
};
