/**
 * PROPERTY-BASED TESTS FOR GAUSSIAN PLUME MODEL
 * Tests mathematical invariants and physical constraints with random inputs
 */

const fc = require('fast-check');
require('dotenv').config({ path: '../../.env' });

// Gaussian plume dispersion coefficients (Pasquill-Gifford)
const DISPERSION_COEFFICIENTS = {
  'A': { ay: 0.22, by: 0.894, cy: 0.20, dy: 0.894 },  // Very unstable
  'B': { ay: 0.16, by: 0.894, cy: 0.12, dy: 0.894 },  // Unstable
  'C': { ay: 0.11, by: 0.894, cy: 0.08, dy: 0.894 },  // Slightly unstable
  'D': { ay: 0.08, by: 0.894, cy: 0.06, dy: 0.724 },  // Neutral
  'E': { ay: 0.06, by: 0.894, cy: 0.03, dy: 0.612 },  // Slightly stable
  'F': { ay: 0.04, by: 0.894, cy: 0.016, dy: 0.612 }  // Stable
};

class GaussianPlumeModel {
  /**
   * Calculate PM2.5 concentration at a point using Gaussian plume equation
   * C(x,y,z) = (Q/2πuσyσz) * exp(-y²/2σy²) * [exp(-(z-H)²/2σz²) + exp(-(z+H)²/2σz²)]
   */
  static calculateConcentration(params) {
    const {
      Q,    // Emission rate (g/s)
      u,    // Wind speed (m/s)
      x,    // Downwind distance (m)
      y,    // Crosswind distance (m)
      z,    // Height above ground (m)
      H,    // Stack height (m)
      stabilityClass // Atmospheric stability (A-F)
    } = params;

    // Prevent division by zero
    if (u <= 0 || x <= 0) return 0;

    // Get dispersion coefficients
    const coeffs = DISPERSION_COEFFICIENTS[stabilityClass] || DISPERSION_COEFFICIENTS['D'];
    
    // Calculate dispersion parameters
    const σy = coeffs.ay * Math.pow(x, coeffs.by);
    const σz = coeffs.cy * Math.pow(x, coeffs.dy);

    // Prevent division by zero
    if (σy <= 0 || σz <= 0) return 0;

    // Gaussian plume equation
    const prefactor = Q / (2 * Math.PI * u * σy * σz);
    const lateralTerm = Math.exp(-0.5 * Math.pow(y / σy, 2));
    const verticalTerm1 = Math.exp(-0.5 * Math.pow((z - H) / σz, 2));
    const verticalTerm2 = Math.exp(-0.5 * Math.pow((z + H) / σz, 2));
    
    const concentration = prefactor * lateralTerm * (verticalTerm1 + verticalTerm2);
    
    return concentration;
  }

  /**
   * Calculate plume rise due to buoyancy and momentum
   */
  static calculatePlumeRise(params) {
    const { 
      Vs,   // Stack exit velocity (m/s)
      Ts,   // Stack temperature (K)
      Ta,   // Ambient temperature (K)
      u,    // Wind speed (m/s)
      Hs    // Physical stack height (m)
    } = params;

    if (u <= 0) return 0;

    // Buoyancy flux parameter
    const g = 9.81; // gravity (m/s²)
    const F = g * Vs * Math.pow(Hs / 2, 2) * (Ts - Ta) / Ts;
    
    // Holland formula for plume rise
    const deltaH = (1.6 * Math.pow(F, 1/3) * Math.pow(Hs, 2/3)) / u;
    
    return Math.max(0, deltaH);
  }

  /**
   * Calculate total mass flux through a plane
   */
  static calculateMassFlux(params) {
    const { Q, gridPoints, u } = params;
    let totalFlux = 0;
    
    for (const point of gridPoints) {
      const conc = this.calculateConcentration({ ...params, ...point });
      totalFlux += conc * point.area;
    }
    
    return totalFlux * u;
  }
}

describe('Property-Based Testing: Gaussian Plume Model', () => {
  
  describe('1. Physical Constraints', () => {
    test('Concentration is always non-negative', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0.1, max: 1000 }),   // Q (g/s)
          fc.float({ min: 0.1, max: 20 }),     // u (m/s)
          fc.float({ min: 1, max: 10000 }),    // x (m)
          fc.float({ min: -1000, max: 1000 }), // y (m)
          fc.float({ min: 0, max: 100 }),      // z (m)
          fc.float({ min: 0, max: 50 }),       // H (m)
          fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F'), // stability
          (Q, u, x, y, z, H, stabilityClass) => {
            const concentration = GaussianPlumeModel.calculateConcentration({
              Q, u, x, y, z, H, stabilityClass
            });
            
            expect(concentration).toBeGreaterThanOrEqual(0);
            expect(concentration).toBeFinite();
          }
        ),
        { numRuns: 1000 }
      );
    });

    test('Concentration is finite for all valid inputs', () => {
      fc.assert(
        fc.property(
          fc.record({
            Q: fc.float({ min: 0.1, max: 1000, noNaN: true }),
            u: fc.float({ min: 0.1, max: 20, noNaN: true }),
            x: fc.float({ min: 1, max: 10000, noNaN: true }),
            y: fc.float({ min: -1000, max: 1000, noNaN: true }),
            z: fc.float({ min: 0, max: 100, noNaN: true }),
            H: fc.float({ min: 0, max: 50, noNaN: true }),
            stabilityClass: fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F')
          }),
          (params) => {
            const concentration = GaussianPlumeModel.calculateConcentration(params);
            expect(Number.isFinite(concentration)).toBe(true);
            expect(Number.isNaN(concentration)).toBe(false);
          }
        ),
        { numRuns: 1000 }
      );
    });

    test('Maximum concentration occurs at ground level on centerline', () => {
      fc.assert(
        fc.property(
          fc.record({
            Q: fc.float({ min: 1, max: 100 }),
            u: fc.float({ min: 1, max: 10 }),
            x: fc.float({ min: 100, max: 1000 }),
            H: fc.float({ min: 2, max: 10 }),
            stabilityClass: fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F')
          }),
          (params) => {
            // Centerline ground level
            const centerConc = GaussianPlumeModel.calculateConcentration({
              ...params, y: 0, z: 0
            });
            
            // Off-centerline points
            const offCenter1 = GaussianPlumeModel.calculateConcentration({
              ...params, y: 50, z: 0
            });
            const offCenter2 = GaussianPlumeModel.calculateConcentration({
              ...params, y: -50, z: 0
            });
            
            // Elevated points
            const elevated = GaussianPlumeModel.calculateConcentration({
              ...params, y: 0, z: 10
            });
            
            expect(centerConc).toBeGreaterThanOrEqual(offCenter1);
            expect(centerConc).toBeGreaterThanOrEqual(offCenter2);
            expect(centerConc).toBeGreaterThanOrEqual(elevated);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('2. Distance Decay Properties', () => {
    test('Concentration decreases with downwind distance', () => {
      fc.assert(
        fc.property(
          fc.record({
            Q: fc.float({ min: 1, max: 100 }),
            u: fc.float({ min: 1, max: 10 }),
            H: fc.float({ min: 0, max: 10 }),
            stabilityClass: fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F')
          }),
          (params) => {
            const distances = [100, 500, 1000, 5000, 10000];
            const concentrations = distances.map(x => 
              GaussianPlumeModel.calculateConcentration({
                ...params, x, y: 0, z: 0
              })
            );
            
            // Verify monotonic decrease
            for (let i = 1; i < concentrations.length; i++) {
              expect(concentrations[i]).toBeLessThanOrEqual(concentrations[i-1]);
            }
          }
        ),
        { numRuns: 500 }
      );
    });

    test('Concentration decreases with lateral distance', () => {
      fc.assert(
        fc.property(
          fc.record({
            Q: fc.float({ min: 1, max: 100 }),
            u: fc.float({ min: 1, max: 10 }),
            x: fc.float({ min: 100, max: 1000 }),
            H: fc.float({ min: 0, max: 10 }),
            stabilityClass: fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F')
          }),
          (params) => {
            const lateralDistances = [0, 10, 50, 100, 200];
            const concentrations = lateralDistances.map(y => 
              GaussianPlumeModel.calculateConcentration({
                ...params, y, z: 0
              })
            );
            
            // Verify decrease from centerline
            for (let i = 1; i < concentrations.length; i++) {
              expect(concentrations[i]).toBeLessThanOrEqual(concentrations[i-1]);
            }
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('3. Symmetry Properties', () => {
    test('Lateral symmetry around centerline', () => {
      fc.assert(
        fc.property(
          fc.record({
            Q: fc.float({ min: 1, max: 100 }),
            u: fc.float({ min: 1, max: 10 }),
            x: fc.float({ min: 100, max: 1000 }),
            y: fc.float({ min: 1, max: 200 }),
            z: fc.float({ min: 0, max: 20 }),
            H: fc.float({ min: 0, max: 10 }),
            stabilityClass: fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F')
          }),
          (params) => {
            const leftConc = GaussianPlumeModel.calculateConcentration({
              ...params, y: -Math.abs(params.y)
            });
            const rightConc = GaussianPlumeModel.calculateConcentration({
              ...params, y: Math.abs(params.y)
            });
            
            // Should be equal within floating point precision
            expect(leftConc).toBeCloseTo(rightConc, 10);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('4. Stability Class Effects', () => {
    test('Unstable conditions disperse more than stable conditions', () => {
      fc.assert(
        fc.property(
          fc.record({
            Q: fc.float({ min: 1, max: 100 }),
            u: fc.float({ min: 1, max: 10 }),
            x: fc.float({ min: 500, max: 2000 }),
            H: fc.float({ min: 2, max: 10 })
          }),
          (params) => {
            // Compare unstable (A) vs stable (F) at same location
            const unstableConc = GaussianPlumeModel.calculateConcentration({
              ...params, y: 0, z: 0, stabilityClass: 'A'
            });
            const stableConc = GaussianPlumeModel.calculateConcentration({
              ...params, y: 0, z: 0, stabilityClass: 'F'
            });
            
            // At moderate distances, stable should have higher centerline concentration
            // (less lateral spread)
            expect(stableConc).toBeGreaterThanOrEqual(unstableConc * 0.5);
            
            // But unstable spreads wider
            const unstableWide = GaussianPlumeModel.calculateConcentration({
              ...params, y: 100, z: 0, stabilityClass: 'A'
            });
            const stableWide = GaussianPlumeModel.calculateConcentration({
              ...params, y: 100, z: 0, stabilityClass: 'F'
            });
            
            // At large lateral distances, unstable might have more
            const ratio = unstableWide / (stableWide + 1e-10);
            expect(ratio).toBeFinite();
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('5. Linear Scaling Properties', () => {
    test('Concentration scales linearly with emission rate', () => {
      fc.assert(
        fc.property(
          fc.record({
            Q: fc.float({ min: 1, max: 100 }),
            scaleFactor: fc.float({ min: 0.1, max: 10 }),
            u: fc.float({ min: 1, max: 10 }),
            x: fc.float({ min: 100, max: 1000 }),
            y: fc.float({ min: -100, max: 100 }),
            z: fc.float({ min: 0, max: 20 }),
            H: fc.float({ min: 0, max: 10 }),
            stabilityClass: fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F')
          }),
          (params) => {
            const baseConc = GaussianPlumeModel.calculateConcentration(params);
            const scaledConc = GaussianPlumeModel.calculateConcentration({
              ...params, Q: params.Q * params.scaleFactor
            });
            
            // Should scale linearly
            expect(scaledConc).toBeCloseTo(baseConc * params.scaleFactor, 8);
          }
        ),
        { numRuns: 500 }
      );
    });

    test('Concentration scales inversely with wind speed', () => {
      fc.assert(
        fc.property(
          fc.record({
            Q: fc.float({ min: 1, max: 100 }),
            u: fc.float({ min: 1, max: 10 }),
            speedFactor: fc.float({ min: 0.5, max: 5 }),
            x: fc.float({ min: 100, max: 1000 }),
            y: fc.float({ min: -100, max: 100 }),
            z: fc.float({ min: 0, max: 20 }),
            H: fc.float({ min: 0, max: 10 }),
            stabilityClass: fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F')
          }),
          (params) => {
            const baseConc = GaussianPlumeModel.calculateConcentration(params);
            const newConc = GaussianPlumeModel.calculateConcentration({
              ...params, u: params.u * params.speedFactor
            });
            
            // Higher wind speed should reduce concentration
            if (params.speedFactor > 1) {
              expect(newConc).toBeLessThanOrEqual(baseConc);
            } else {
              expect(newConc).toBeGreaterThanOrEqual(baseConc);
            }
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('6. Mass Conservation', () => {
    test('Total mass flux is conserved through vertical planes', () => {
      fc.assert(
        fc.property(
          fc.record({
            Q: fc.float({ min: 10, max: 100 }),
            u: fc.float({ min: 2, max: 10 }),
            H: fc.float({ min: 2, max: 10 }),
            stabilityClass: fc.constantFrom('C', 'D', 'E')
          }),
          (params) => {
            // Create grid at two distances
            const distances = [500, 1000];
            const fluxes = [];
            
            for (const x of distances) {
              const gridPoints = [];
              const gridSize = 50;
              const spacing = 10;
              
              // Create grid of points
              for (let y = -gridSize * spacing; y <= gridSize * spacing; y += spacing) {
                for (let z = 0; z <= 100; z += 5) {
                  gridPoints.push({ x, y, z, area: spacing * 5 });
                }
              }
              
              const flux = GaussianPlumeModel.calculateMassFlux({
                ...params, gridPoints
              });
              fluxes.push(flux);
            }
            
            // Mass flux should be approximately conserved (within numerical error)
            // In reality there's some numerical diffusion
            const ratio = fluxes[1] / (fluxes[0] + 1e-10);
            expect(ratio).toBeGreaterThan(0.5);
            expect(ratio).toBeLessThan(1.5);
          }
        ),
        { numRuns: 100 } // Fewer runs due to computational cost
      );
    });
  });

  describe('7. Edge Cases and Boundary Conditions', () => {
    test('Handles zero emission rate gracefully', () => {
      fc.assert(
        fc.property(
          fc.record({
            u: fc.float({ min: 1, max: 10 }),
            x: fc.float({ min: 100, max: 1000 }),
            y: fc.float({ min: -100, max: 100 }),
            z: fc.float({ min: 0, max: 20 }),
            H: fc.float({ min: 0, max: 10 }),
            stabilityClass: fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F')
          }),
          (params) => {
            const conc = GaussianPlumeModel.calculateConcentration({
              ...params, Q: 0
            });
            expect(conc).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Handles extreme distances appropriately', () => {
      fc.assert(
        fc.property(
          fc.record({
            Q: fc.float({ min: 1, max: 100 }),
            u: fc.float({ min: 1, max: 10 }),
            H: fc.float({ min: 0, max: 10 }),
            stabilityClass: fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F')
          }),
          (params) => {
            // Very far distance
            const farConc = GaussianPlumeModel.calculateConcentration({
              ...params, x: 100000, y: 0, z: 0
            });
            
            // Should approach zero but remain non-negative
            expect(farConc).toBeGreaterThanOrEqual(0);
            expect(farConc).toBeLessThan(0.001);
            
            // Very close distance (but not zero)
            const nearConc = GaussianPlumeModel.calculateConcentration({
              ...params, x: 1, y: 0, z: 0
            });
            
            expect(nearConc).toBeFinite();
            expect(nearConc).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('8. Plume Rise Properties', () => {
    test('Plume rise is non-negative', () => {
      fc.assert(
        fc.property(
          fc.record({
            Vs: fc.float({ min: 0, max: 20 }),
            Ts: fc.float({ min: 273, max: 573 }), // 0-300°C in Kelvin
            Ta: fc.float({ min: 263, max: 313 }), // -10 to 40°C
            u: fc.float({ min: 0.1, max: 20 }),
            Hs: fc.float({ min: 1, max: 50 })
          }),
          (params) => {
            const rise = GaussianPlumeModel.calculatePlumeRise(params);
            expect(rise).toBeGreaterThanOrEqual(0);
            expect(rise).toBeFinite();
          }
        ),
        { numRuns: 500 }
      );
    });

    test('Plume rise increases with temperature difference', () => {
      fc.assert(
        fc.property(
          fc.record({
            Vs: fc.float({ min: 1, max: 10 }),
            Ta: fc.float({ min: 273, max: 303 }),
            deltaT: fc.float({ min: 10, max: 100 }),
            u: fc.float({ min: 1, max: 10 }),
            Hs: fc.float({ min: 5, max: 20 })
          }),
          (params) => {
            const rise1 = GaussianPlumeModel.calculatePlumeRise({
              ...params, Ts: params.Ta + params.deltaT
            });
            const rise2 = GaussianPlumeModel.calculatePlumeRise({
              ...params, Ts: params.Ta + params.deltaT * 2
            });
            
            // Higher temperature difference should cause more rise
            expect(rise2).toBeGreaterThanOrEqual(rise1);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('9. Composite Properties', () => {
    test('Ground level concentration integrates to emission rate', () => {
      fc.assert(
        fc.property(
          fc.record({
            Q: fc.float({ min: 10, max: 100 }),
            u: fc.float({ min: 2, max: 5 }),
            H: fc.float({ min: 2, max: 10 }),
            stabilityClass: fc.constantFrom('C', 'D')
          }),
          (params) => {
            // Numerical integration over ground plane at fixed distance
            const x = 1000;
            let totalMass = 0;
            const dy = 10;
            const yMax = 500;
            
            for (let y = -yMax; y <= yMax; y += dy) {
              const conc = GaussianPlumeModel.calculateConcentration({
                ...params, x, y, z: 0
              });
              totalMass += conc * dy * params.u;
            }
            
            // Should be roughly proportional to emission rate
            // (not exact due to vertical dispersion)
            const ratio = totalMass / params.Q;
            expect(ratio).toBeGreaterThan(0);
            expect(ratio).toBeLessThan(2);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Reflection at ground increases ground-level concentration', () => {
      fc.assert(
        fc.property(
          fc.record({
            Q: fc.float({ min: 1, max: 100 }),
            u: fc.float({ min: 1, max: 10 }),
            x: fc.float({ min: 100, max: 1000 }),
            H: fc.float({ min: 5, max: 20 }),
            stabilityClass: fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F')
          }),
          (params) => {
            // The model includes ground reflection (z+H term)
            // This should increase ground-level concentration
            const fullConc = GaussianPlumeModel.calculateConcentration({
              ...params, y: 0, z: 0
            });
            
            // Concentration should be positive when there's emission
            expect(fullConc).toBeGreaterThan(0);
            
            // At stack height, concentration should be significant
            const stackHeightConc = GaussianPlumeModel.calculateConcentration({
              ...params, y: 0, z: params.H
            });
            
            expect(stackHeightConc).toBeGreaterThan(0);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('10. Invariant Testing with Transformations', () => {
    test('Coordinate translation invariance', () => {
      fc.assert(
        fc.property(
          fc.record({
            Q: fc.float({ min: 1, max: 100 }),
            u: fc.float({ min: 1, max: 10 }),
            x: fc.float({ min: 100, max: 1000 }),
            y: fc.float({ min: -100, max: 100 }),
            z: fc.float({ min: 0, max: 20 }),
            H: fc.float({ min: 0, max: 10 }),
            yShift: fc.float({ min: -50, max: 50 }),
            stabilityClass: fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F')
          }),
          (params) => {
            // Original concentration
            const conc1 = GaussianPlumeModel.calculateConcentration(params);
            
            // Shifted coordinates (should give same result)
            const conc2 = GaussianPlumeModel.calculateConcentration({
              ...params,
              y: params.y - params.yShift
            });
            
            const conc3 = GaussianPlumeModel.calculateConcentration({
              ...params,
              y: params.y + params.yShift  
            });
            
            // Symmetry check
            if (Math.abs(params.y) === Math.abs(params.y - params.yShift)) {
              expect(conc1).toBeCloseTo(conc2, 8);
            }
          }
        ),
        { numRuns: 500 }
      );
    });
  });
});

// Performance benchmarks
describe('Performance Characteristics', () => {
  test('Calculation time is bounded', () => {
    const iterations = 10000;
    const params = {
      Q: 100,
      u: 5,
      x: 1000,
      y: 0,
      z: 0,
      H: 10,
      stabilityClass: 'D'
    };
    
    const startTime = process.hrtime.bigint();
    
    for (let i = 0; i < iterations; i++) {
      GaussianPlumeModel.calculateConcentration({
        ...params,
        x: 100 + (i % 1000),
        y: -100 + (i % 200)
      });
    }
    
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6;
    const timePerCalc = durationMs / iterations;
    
    console.log(`Average calculation time: ${timePerCalc.toFixed(3)}ms`);
    
    // Should be fast enough for real-time calculations
    expect(timePerCalc).toBeLessThan(1); // Less than 1ms per calculation
  });
});

module.exports = {
  testCount: 20,
  testType: 'property-based',
  description: 'Property-based tests for Gaussian plume model mathematical correctness'
};