import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Home from '../app/page';
// A server-render smoke check, not browser or interaction coverage.
describe('Phase 1 overview render',()=>{
 it('renders the workout definition and clearly identifies the prototype',()=>{
  const html=renderToStaticMarkup(<Home/>);
  expect(html).toContain('Pull-ups');
  expect(html).toContain('Push-ups');
  expect(html).toContain('Air squats');
  expect(html).toContain('20-minute cap');
  expect(html).toContain('30 reps / round');
  expect(html).toContain('DESIGN PREVIEW');
  expect(html).toContain('No live timer or saved workouts yet');
  expect(html).toContain('START WORKOUT');
 });
});
