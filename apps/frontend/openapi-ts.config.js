/** @type {import('@hey-api/openapi-ts').UserConfig} */
export default {
  input: 'http://localhost:10714/swagger/v1/swagger.json',
  output: {
    path: 'src/generated/api',
    format: 'prettier',
  },
  plugins: ['@hey-api/client-fetch'],
};
