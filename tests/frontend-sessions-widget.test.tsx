/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FrontendSessions } from '../ui/app/components/widget/FrontendSessions';
import { discoverSessionFrontends, loadFrontendSessions } from '../ui/app/services/FrontendSessions';
jest.mock('../ui/app/services/FrontendSessions', () => ({ discoverSessionFrontends: jest.fn(), loadFrontendSessions: jest.fn() }));
jest.mock('@dynatrace/strato-components-preview/charts', () => {
  const Chart = () => <div data-testid="chart" />;
  return { TimeseriesChart: Object.assign(Chart, { YAxis: () => null, Legend: () => null }) };
});
jest.mock('@dynatrace/strato-components-preview/forms', () => {
  const Select = ({multiple, value, onChange, children}: any) => <select aria-label={multiple ? 'frontends' : 'mode'} multiple={multiple} value={value} onChange={event => onChange(multiple ? Array.from(event.target.selectedOptions).map((o: any) => o.value) : event.target.value)}>{children}</select>;
  return { Select: Object.assign(Select, { Filter: () => null, Trigger: () => null, Content: ({children}: any) => <>{children}</>, Option: ({value,children}: any) => <option value={value}>{children}</option> }) };
});
const options = ['A','B','C'].map(name => ({ id:`APPLICATION-${name.repeat(16)}`, name }));
const filters = { cluster:{value:'cluster1'}, timeframe:{value:{from:{absoluteDate:'2026-09-17'},to:{absoluteDate:'2026-09-18'}}} };
test('A+B selection survives refresh, clearing does not fetch all, new Kubernetes scope resets selection', async () => {
  jest.mocked(discoverSessionFrontends).mockResolvedValue(options);
  jest.mocked(loadFrontendSessions).mockResolvedValue({total:[],individual:[],baselineTotal:[],baselineIndividual:[],resolution:'1m',notices:[]});
  const view = render(<FrontendSessions filters={filters as never} />);
  await waitFor(() => expect(loadFrontendSessions).toHaveBeenCalled());
  const select = screen.getByLabelText('frontends') as HTMLSelectElement;
  expect(select.options[0].text).toBe('A');
  expect(select.options[0].value).toBe(options[0].id);
  select.options[2].selected = false;
  fireEvent.change(select);
  await waitFor(() => expect(jest.mocked(loadFrontendSessions).mock.calls.at(-1)?.[0]).toEqual(options.slice(0,2)));
  view.rerender(<FrontendSessions filters={filters as never} lastRefreshedAt={new Date()} />);
  await waitFor(() => expect(discoverSessionFrontends).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByText('2 de 3 frontends')).toBeTruthy());
  const refreshed = screen.getByLabelText('frontends') as HTMLSelectElement;
  Array.from(refreshed.options).forEach(o => {o.selected=false;});
  const calls = jest.mocked(loadFrontendSessions).mock.calls.length;
  fireEvent.change(refreshed);
  await waitFor(() => expect(screen.getByText('Selecione um ou mais frontends para visualizar as sessões.')).toBeTruthy());
  expect(loadFrontendSessions).toHaveBeenCalledTimes(calls);
  view.rerender(<FrontendSessions filters={{...filters,cluster:{value:'cluster2'}} as never} />);
  await waitFor(() => expect(screen.getByText('3 de 3 frontends')).toBeTruthy());
  await waitFor(() => expect(jest.mocked(loadFrontendSessions).mock.calls.at(-1)?.[0]).toEqual(options));
});
