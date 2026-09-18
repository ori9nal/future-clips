// Test-time module hooks: `server-only` is a build-time guard (it throws when
// imported outside a React server bundle), so the tests resolve it to an
// empty module and exercise the pure helpers directly.
import { register } from 'node:module';
register('./test-hooks-impl.mjs', import.meta.url);
