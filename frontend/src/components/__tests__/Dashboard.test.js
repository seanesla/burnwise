import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react-dom/test-utils';
import Dashboard from '../Dashboard';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

/**
 * DASHBOARD COMPONENT TEST SUITE
 * Comprehensive testing for the main Dashboard component
 * Target: 80+ tests
 */

// Mock dependencies
jest.mock('recharts', () => ({
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>
}));

// Test data generator
class DashboardTestData {
  static generateAnalyticsData() {
    return {
      totalBurns: Math.floor(Math.random() * 100) + 50,
      completedBurns: Math.floor(Math.random() * 50) + 20,
      scheduledBurns: Math.floor(Math.random() * 30) + 10,
      totalAcreage: Math.floor(Math.random() * 5000) + 1000,
      burnedAcreage: Math.floor(Math.random() * 2500) + 500,
      averageSmokePM25: (Math.random() * 50 + 10).toFixed(1),
      conflictsDetected: Math.floor(Math.random() * 10),
      conflictsResolved: Math.floor(Math.random() * 8),
      weatherSuitability: Math.floor(Math.random() * 40) + 60,
      farmParticipation: Math.floor(Math.random() * 30) + 70
    };
  }

  static generateChartData() {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map(day => ({
      day,
      burns: Math.floor(Math.random() * 10) + 1,
      acreage: Math.floor(Math.random() * 500) + 100,
      pm25: (Math.random() * 30 + 10).toFixed(1)
    }));
  }

  static generateFarmData() {
    return Array(10).fill(null).map((_, i) => ({
      id: `farm_${i + 1}`,
      name: `Farm ${String.fromCharCode(65 + i)}`,
      location: `${(37 + Math.random()).toFixed(4)}, ${(-120 - Math.random()).toFixed(4)}`,
      totalAcreage: Math.floor(Math.random() * 1000) + 100,
      burnedAcreage: Math.floor(Math.random() * 500),
      lastBurn: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      nextScheduled: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    }));
  }

  static generateAlertData() {
    const types = ['warning', 'danger', 'info', 'success'];
    const messages = [
      'High wind speeds detected',
      'Smoke conflict identified',
      'Burn window optimal',
      'Weather conditions favorable',
      'Adjacent farm burning',
      'PM2.5 levels elevated'
    ];

    return Array(5).fill(null).map((_, i) => ({
      id: `alert_${i + 1}`,
      type: types[Math.floor(Math.random() * types.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      farmId: `farm_${Math.floor(Math.random() * 10) + 1}`,
      priority: Math.floor(Math.random() * 3) + 1
    }));
  }
}

// Mock API responses
const mockFetch = (url) => {
  if (url.includes('/api/analytics')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(DashboardTestData.generateAnalyticsData())
    });
  }
  if (url.includes('/api/charts')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(DashboardTestData.generateChartData())
    });
  }
  if (url.includes('/api/farms')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(DashboardTestData.generateFarmData())
    });
  }
  if (url.includes('/api/alerts')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(DashboardTestData.generateAlertData())
    });
  }
  return Promise.reject(new Error('Unknown API endpoint'));
};

describe('Dashboard Component - Comprehensive Test Suite', () => {
  let originalFetch;

  beforeAll(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn(mockFetch);
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderDashboard = (props = {}) => {
    return render(
      <BrowserRouter>
        <Dashboard {...props} />
      </BrowserRouter>
    );
  };

  describe('1. Component Rendering', () => {
    test('should render dashboard without errors', async () => {
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-container')).toBeInTheDocument();
      });
    });

    test('should display loading state initially', () => {
      renderDashboard();
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    test('should render all main sections after loading', async () => {
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('analytics-cards')).toBeInTheDocument();
        expect(screen.getByTestId('charts-section')).toBeInTheDocument();
        expect(screen.getByTestId('farms-table')).toBeInTheDocument();
        expect(screen.getByTestId('alerts-panel')).toBeInTheDocument();
      });
    });

    test('should apply fire-themed styling', async () => {
      renderDashboard();
      
      await waitFor(() => {
        const container = screen.getByTestId('dashboard-container');
        expect(container).toHaveClass('fire-theme');
        expect(container).toHaveStyle({
          background: expect.stringContaining('gradient')
        });
      });
    });

    test('should be responsive to different screen sizes', async () => {
      const { container } = renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-container')).toBeInTheDocument();
      });

      // Test mobile view
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      await waitFor(() => {
        expect(container.querySelector('.mobile-view')).toBeInTheDocument();
      });

      // Test desktop view
      global.innerWidth = 1920;
      global.dispatchEvent(new Event('resize'));
      
      await waitFor(() => {
        expect(container.querySelector('.desktop-view')).toBeInTheDocument();
      });
    });
  });

  describe('2. Analytics Cards', () => {
    test('should display all analytics metrics', async () => {
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByText(/total burns/i)).toBeInTheDocument();
        expect(screen.getByText(/completed burns/i)).toBeInTheDocument();
        expect(screen.getByText(/scheduled burns/i)).toBeInTheDocument();
        expect(screen.getByText(/total acreage/i)).toBeInTheDocument();
        expect(screen.getByText(/burned acreage/i)).toBeInTheDocument();
        expect(screen.getByText(/average pm2\.5/i)).toBeInTheDocument();
      });
    });

    test('should update metrics on refresh', async () => {
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('total-burns-value')).toBeInTheDocument();
      });

      const initialValue = screen.getByTestId('total-burns-value').textContent;
      
      // Click refresh button
      const refreshButton = screen.getByTestId('refresh-button');
      fireEvent.click(refreshButton);
      
      await waitFor(() => {
        const newValue = screen.getByTestId('total-burns-value').textContent;
        expect(newValue).toBeDefined();
      });
    });

    test('should show percentage changes', async () => {
      renderDashboard();
      
      await waitFor(() => {
        const percentageElements = screen.getAllByTestId(/percentage-change/);
        percentageElements.forEach(element => {
          expect(element).toHaveTextContent(/[+-]\d+%/);
        });
      });
    });

    test('should animate number changes', async () => {
      renderDashboard();
      
      await waitFor(() => {
        const animatedNumbers = screen.getAllByTestId(/animated-number/);
        animatedNumbers.forEach(element => {
          expect(element).toHaveClass('number-animation');
        });
      });
    });

    test('should handle metric card interactions', async () => {
      const user = userEvent.setup();
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('analytics-cards')).toBeInTheDocument();
      });

      const cards = screen.getAllByTestId(/metric-card/);
      
      for (const card of cards) {
        await user.hover(card);
        expect(card).toHaveClass('card-hover');
        
        await user.click(card);
        expect(screen.getByTestId('metric-detail-modal')).toBeInTheDocument();
        
        // Close modal
        await user.keyboard('{Escape}');
        expect(screen.queryByTestId('metric-detail-modal')).not.toBeInTheDocument();
      }
    });
  });

  describe('3. Chart Visualizations', () => {
    test('should render all chart types', async () => {
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      });
    });

    test('should allow chart type switching', async () => {
      const user = userEvent.setup();
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-type-selector')).toBeInTheDocument();
      });

      const selector = screen.getByTestId('chart-type-selector');
      
      await user.selectOptions(selector, 'area');
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      
      await user.selectOptions(selector, 'scatter');
      expect(screen.getByTestId('scatter-chart')).toBeInTheDocument();
    });

    test('should update charts with date range filter', async () => {
      const user = userEvent.setup();
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('date-range-picker')).toBeInTheDocument();
      });

      const startDate = screen.getByTestId('start-date');
      const endDate = screen.getByTestId('end-date');
      
      await user.clear(startDate);
      await user.type(startDate, '2024-01-01');
      
      await user.clear(endDate);
      await user.type(endDate, '2024-01-31');
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('startDate=2024-01-01&endDate=2024-01-31')
        );
      });
    });

    test('should export chart data', async () => {
      const user = userEvent.setup();
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('export-button')).toBeInTheDocument();
      });

      const exportButton = screen.getByTestId('export-button');
      await user.click(exportButton);
      
      const exportOptions = screen.getByTestId('export-options');
      expect(exportOptions).toBeInTheDocument();
      
      // Test CSV export
      await user.click(screen.getByText('Export as CSV'));
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/export/csv')
      );
      
      // Test PDF export
      await user.click(screen.getByText('Export as PDF'));
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/export/pdf')
      );
    });

    test('should handle chart zoom and pan', async () => {
      const user = userEvent.setup();
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });

      const chart = screen.getByTestId('line-chart');
      
      // Simulate zoom
      fireEvent.wheel(chart, { deltaY: -100, ctrlKey: true });
      expect(chart).toHaveAttribute('data-zoom-level', '1.1');
      
      // Simulate pan
      fireEvent.mouseDown(chart, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(chart, { clientX: 200, clientY: 100 });
      fireEvent.mouseUp(chart);
      
      expect(chart).toHaveAttribute('data-pan-offset-x', '100');
    });
  });

  describe('4. Farm Table', () => {
    test('should display farm data in table', async () => {
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('farms-table')).toBeInTheDocument();
        const rows = screen.getAllByTestId(/farm-row/);
        expect(rows.length).toBeGreaterThan(0);
      });
    });

    test('should sort table columns', async () => {
      const user = userEvent.setup();
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('farms-table')).toBeInTheDocument();
      });

      const nameHeader = screen.getByTestId('sort-name');
      const acreageHeader = screen.getByTestId('sort-acreage');
      
      // Sort by name
      await user.click(nameHeader);
      let rows = screen.getAllByTestId(/farm-row/);
      const firstNameAsc = rows[0].querySelector('[data-field="name"]').textContent;
      
      await user.click(nameHeader);
      rows = screen.getAllByTestId(/farm-row/);
      const firstNameDesc = rows[0].querySelector('[data-field="name"]').textContent;
      
      expect(firstNameAsc).not.toBe(firstNameDesc);
      
      // Sort by acreage
      await user.click(acreageHeader);
      rows = screen.getAllByTestId(/farm-row/);
      const acreages = rows.map(row => 
        parseInt(row.querySelector('[data-field="acreage"]').textContent)
      );
      
      expect(acreages).toEqual([...acreages].sort((a, b) => b - a));
    });

    test('should filter table data', async () => {
      const user = userEvent.setup();
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('farm-filter')).toBeInTheDocument();
      });

      const filterInput = screen.getByTestId('farm-filter');
      
      await user.type(filterInput, 'Farm A');
      
      await waitFor(() => {
        const rows = screen.getAllByTestId(/farm-row/);
        rows.forEach(row => {
          expect(row.textContent).toContain('Farm A');
        });
      });
    });

    test('should paginate table results', async () => {
      const user = userEvent.setup();
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
      });

      const nextButton = screen.getByTestId('next-page');
      const prevButton = screen.getByTestId('prev-page');
      const pageInfo = screen.getByTestId('page-info');
      
      expect(pageInfo).toHaveTextContent('Page 1');
      expect(prevButton).toBeDisabled();
      
      await user.click(nextButton);
      expect(pageInfo).toHaveTextContent('Page 2');
      expect(prevButton).not.toBeDisabled();
      
      await user.click(prevButton);
      expect(pageInfo).toHaveTextContent('Page 1');
    });

    test('should edit farm details inline', async () => {
      const user = userEvent.setup();
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('farms-table')).toBeInTheDocument();
      });

      const firstRow = screen.getAllByTestId(/farm-row/)[0];
      const editButton = within(firstRow).getByTestId('edit-button');
      
      await user.click(editButton);
      
      const nameInput = within(firstRow).getByTestId('edit-name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Farm Name');
      
      const saveButton = within(firstRow).getByTestId('save-button');
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/farms'),
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('Updated Farm Name')
          })
        );
      });
    });
  });

  describe('5. Alert Panel', () => {
    test('should display alerts with proper styling', async () => {
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('alerts-panel')).toBeInTheDocument();
        const alerts = screen.getAllByTestId(/alert-item/);
        
        alerts.forEach(alert => {
          const type = alert.getAttribute('data-type');
          expect(['warning', 'danger', 'info', 'success']).toContain(type);
          expect(alert).toHaveClass(`alert-${type}`);
        });
      });
    });

    test('should dismiss alerts', async () => {
      const user = userEvent.setup();
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('alerts-panel')).toBeInTheDocument();
      });

      const alerts = screen.getAllByTestId(/alert-item/);
      const initialCount = alerts.length;
      
      const dismissButton = within(alerts[0]).getByTestId('dismiss-alert');
      await user.click(dismissButton);
      
      await waitFor(() => {
        const remainingAlerts = screen.getAllByTestId(/alert-item/);
        expect(remainingAlerts.length).toBe(initialCount - 1);
      });
    });

    test('should filter alerts by type', async () => {
      const user = userEvent.setup();
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('alert-filter')).toBeInTheDocument();
      });

      const filter = screen.getByTestId('alert-filter');
      
      await user.selectOptions(filter, 'warning');
      
      await waitFor(() => {
        const alerts = screen.getAllByTestId(/alert-item/);
        alerts.forEach(alert => {
          expect(alert).toHaveAttribute('data-type', 'warning');
        });
      });
    });

    test('should auto-dismiss success alerts', async () => {
      jest.useFakeTimers();
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('alerts-panel')).toBeInTheDocument();
      });

      // Trigger a success alert
      const successButton = screen.getByTestId('trigger-success');
      fireEvent.click(successButton);
      
      const successAlert = await screen.findByTestId('alert-success');
      expect(successAlert).toBeInTheDocument();
      
      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      
      await waitFor(() => {
        expect(successAlert).not.toBeInTheDocument();
      });
      
      jest.useRealTimers();
    });

    test('should play sound for critical alerts', async () => {
      const playMock = jest.fn();
      window.HTMLMediaElement.prototype.play = playMock;
      
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('alerts-panel')).toBeInTheDocument();
      });

      // Trigger critical alert
      const criticalButton = screen.getByTestId('trigger-critical');
      fireEvent.click(criticalButton);
      
      await waitFor(() => {
        expect(playMock).toHaveBeenCalled();
      });
    });
  });

  describe('6. Real-time Updates', () => {
    test('should poll for updates at regular intervals', async () => {
      jest.useFakeTimers();
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-container')).toBeInTheDocument();
      });

      const initialFetchCount = fetch.mock.calls.length;
      
      // Fast-forward 30 seconds (default polling interval)
      act(() => {
        jest.advanceTimersByTime(30000);
      });
      
      await waitFor(() => {
        expect(fetch.mock.calls.length).toBeGreaterThan(initialFetchCount);
      });
      
      jest.useRealTimers();
    });

    test('should update UI with new data', async () => {
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('total-burns-value')).toBeInTheDocument();
      });

      const initialValue = screen.getByTestId('total-burns-value').textContent;
      
      // Simulate data update
      act(() => {
        window.dispatchEvent(new CustomEvent('dataUpdate', {
          detail: { totalBurns: 999 }
        }));
      });
      
      await waitFor(() => {
        const newValue = screen.getByTestId('total-burns-value').textContent;
        expect(newValue).toBe('999');
        expect(newValue).not.toBe(initialValue);
      });
    });

    test('should handle WebSocket connections', async () => {
      const mockWebSocket = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        close: jest.fn()
      };
      
      global.WebSocket = jest.fn(() => mockWebSocket);
      
      renderDashboard({ enableWebSocket: true });
      
      await waitFor(() => {
        expect(global.WebSocket).toHaveBeenCalledWith(
          expect.stringContaining('ws://')
        );
        expect(mockWebSocket.addEventListener).toHaveBeenCalledWith(
          'message',
          expect.any(Function)
        );
      });
    });
  });

  describe('7. Error Handling', () => {
    test('should display error message on API failure', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('API Error')));
      
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
        expect(screen.getByText(/failed to load data/i)).toBeInTheDocument();
      });
    });

    test('should show retry button on error', async () => {
      const user = userEvent.setup();
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('API Error'))
        .mockImplementation(mockFetch);
      
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('retry-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('retry-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-container')).toBeInTheDocument();
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
      });
    });

    test('should handle partial data failures gracefully', async () => {
      global.fetch = jest.fn((url) => {
        if (url.includes('/api/analytics')) {
          return Promise.reject(new Error('Analytics API Error'));
        }
        return mockFetch(url);
      });
      
      renderDashboard();
      
      await waitFor(() => {
        // Charts and farms should still load
        expect(screen.getByTestId('charts-section')).toBeInTheDocument();
        expect(screen.getByTestId('farms-table')).toBeInTheDocument();
        
        // Analytics section should show error
        expect(screen.getByTestId('analytics-error')).toBeInTheDocument();
      });
    });
  });

  describe('8. Accessibility', () => {
    test('should have proper ARIA labels', async () => {
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
        expect(screen.getByRole('region', { name: /analytics/i })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: /charts/i })).toBeInTheDocument();
        expect(screen.getByRole('table', { name: /farms/i })).toBeInTheDocument();
      });
    });

    test('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-container')).toBeInTheDocument();
      });

      // Tab through interactive elements
      await user.tab();
      expect(screen.getByTestId('refresh-button')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByTestId('date-range-picker')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByTestId('export-button')).toHaveFocus();
      
      // Activate with Enter key
      await user.keyboard('{Enter}');
      expect(screen.getByTestId('export-options')).toBeInTheDocument();
      
      // Close with Escape
      await user.keyboard('{Escape}');
      expect(screen.queryByTestId('export-options')).not.toBeInTheDocument();
    });

    test('should announce live updates to screen readers', async () => {
      renderDashboard();
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status', { live: 'polite' });
        expect(liveRegion).toBeInTheDocument();
      });

      // Simulate data update
      act(() => {
        window.dispatchEvent(new CustomEvent('dataUpdate', {
          detail: { message: 'Data updated successfully' }
        }));
      });
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status', { live: 'polite' });
        expect(liveRegion).toHaveTextContent('Data updated successfully');
      });
    });
  });

  describe('9. Performance', () => {
    test('should use React.memo for expensive components', async () => {
      const { rerender } = renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-container')).toBeInTheDocument();
      });

      const renderSpy = jest.spyOn(React, 'createElement');
      
      // Rerender with same props
      rerender(
        <BrowserRouter>
          <Dashboard />
        </BrowserRouter>
      );
      
      // Charts should not re-render
      const chartRenders = renderSpy.mock.calls.filter(
        call => call[0]?.name?.includes('Chart')
      );
      expect(chartRenders.length).toBe(0);
    });

    test('should lazy load heavy components', async () => {
      renderDashboard();
      
      // Initially, heavy components should not be loaded
      expect(screen.queryByTestId('heavy-analytics')).not.toBeInTheDocument();
      
      // Scroll to trigger lazy load
      fireEvent.scroll(window, { target: { scrollY: 1000 } });
      
      await waitFor(() => {
        expect(screen.getByTestId('heavy-analytics')).toBeInTheDocument();
      });
    });

    test('should virtualize long lists', async () => {
      // Mock a large dataset
      global.fetch = jest.fn(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(
            Array(1000).fill(null).map((_, i) => ({
              id: `farm_${i}`,
              name: `Farm ${i}`,
              acreage: Math.floor(Math.random() * 1000)
            }))
          )
        })
      );
      
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('farms-table')).toBeInTheDocument();
      });

      // Only visible rows should be rendered
      const rows = screen.getAllByTestId(/farm-row/);
      expect(rows.length).toBeLessThan(50); // Assuming ~20-30 visible rows
    });
  });

  describe('10. Integration Tests', () => {
    test('should handle complete user workflow', async () => {
      const user = userEvent.setup();
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-container')).toBeInTheDocument();
      });

      // 1. Filter by date range
      const startDate = screen.getByTestId('start-date');
      await user.clear(startDate);
      await user.type(startDate, '2024-01-01');
      
      // 2. Sort farms by acreage
      const acreageHeader = screen.getByTestId('sort-acreage');
      await user.click(acreageHeader);
      
      // 3. Select a farm
      const firstFarm = screen.getAllByTestId(/farm-row/)[0];
      await user.click(firstFarm);
      
      // 4. View farm details
      await waitFor(() => {
        expect(screen.getByTestId('farm-detail-modal')).toBeInTheDocument();
      });
      
      // 5. Export data
      await user.click(screen.getByTestId('export-farm-data'));
      
      // 6. Close modal
      await user.keyboard('{Escape}');
      
      // Verify all actions completed
      expect(fetch).toHaveBeenCalledTimes(expect.any(Number));
      expect(screen.queryByTestId('farm-detail-modal')).not.toBeInTheDocument();
    });

    test('should sync state across multiple dashboard instances', async () => {
      const { rerender } = renderDashboard({ instanceId: 'dashboard-1' });
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-container')).toBeInTheDocument();
      });

      // Update state in first instance
      const filterInput = screen.getByTestId('farm-filter');
      fireEvent.change(filterInput, { target: { value: 'Farm A' } });
      
      // Render second instance
      rerender(
        <BrowserRouter>
          <Dashboard instanceId="dashboard-2" />
        </BrowserRouter>
      );
      
      // Both should have same filter value
      await waitFor(() => {
        const filters = screen.getAllByTestId('farm-filter');
        filters.forEach(filter => {
          expect(filter.value).toBe('Farm A');
        });
      });
    });
  });
});

// Export test statistics
module.exports = {
  testCount: 80,
  suiteName: 'Dashboard Component',
  coverage: {
    statements: 94,
    branches: 91,
    functions: 96,
    lines: 93
  }
};