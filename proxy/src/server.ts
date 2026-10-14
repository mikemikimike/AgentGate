import fastify from 'fastify';
import routes from './api';

const app = fastify({
  logger: true
});

app.register(routes);

const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;

app.listen({ port, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Proxy listening at ${address}`);
});
