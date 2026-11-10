/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';

import InstitutionIcon from './InstitutionIcon';

jest.mock(
  '@docusaurus/useBaseUrl',
  () => ({ __esModule: true, useBaseUrlUtils: () => ({ withBaseUrl: (url: string) => `/base${url}` }) }),
  { virtual: true }
);

describe('InstitutionIcon', () => {
  it("shows the icon, or else the institution's initial, with any styles given as one or several", () => {
    const { container } = render(
      <>
        <InstitutionIcon
          name="Icon University"
          icon="/img/institutions/icon-university.png"
          sx={[{ m: 1 }]}
        />
        <InstitutionIcon name="Plain University" size={20} sx={{ m: 1 }} />
        <InstitutionIcon name="Other University" sx={[{ m: 1 }, { p: 1 }]} />
      </>
    );
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      '/base/img/institutions/icon-university.png'
    );
    expect(container).toHaveTextContent('PO');
  });
});
