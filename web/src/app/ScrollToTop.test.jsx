import { render } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { ScrollToTop } from './ScrollToTop';

afterEach(() => vi.restoreAllMocks());

function setup() {
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(
    <MemoryRouter initialEntries={['/courses']}>
      <ScrollToTop />
      <Link to="/login">Log in</Link>
      <Link to="/courses?q=maths">Search</Link>
      <Link to="/courses#faq">Hash</Link>
      <Routes><Route path="*" element={null} /></Routes>
    </MemoryRouter>,
  );
  return scrollTo;
}

test('opening another page starts at the top', async () => {
  const scrollTo = setup();
  scrollTo.mockClear();
  await userEvent.click(document.querySelector('a[href="/login"]'));
  expect(scrollTo).toHaveBeenCalledWith(0, 0);
});

test('changing only the search text on the same page keeps the scroll position', async () => {
  const scrollTo = setup();
  scrollTo.mockClear();
  await userEvent.click(document.querySelector('a[href="/courses?q=maths"]'));
  expect(scrollTo).not.toHaveBeenCalled();
});

test('a link to a #section is left to the browser', async () => {
  const scrollTo = setup();
  scrollTo.mockClear();
  await userEvent.click(document.querySelector('a[href="/courses#faq"]'));
  expect(scrollTo).not.toHaveBeenCalled();
});
