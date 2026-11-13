import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Home from '../app/page';
// A server-render smoke check, not browser or interaction coverage.
describe('Phase 3 overview render',()=>{
 it('renders the workout definition and clearly shows an empty history without mock records',()=>{
  const html=renderToStaticMarkup(<Home/>);
  expect(html).toContain('Pull-ups');
  expect(html).toContain('Push-ups');
  expect(html).toContain('Air squats');
  expect(html).toContain('20-minute cap');
  expect(html).toContain('30 reps / round');
  expect(html).toContain('YOUR WORK. YOUR RECORD.');
  expect(html).toContain('No saved workouts yet.');
  expect(html).toContain('Start Cindy Workout');
 });
});
