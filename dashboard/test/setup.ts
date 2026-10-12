import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import * as axeMatchers from 'vitest-axe/matchers';

expect.extend(matchers);
expect.extend(axeMatchers);
