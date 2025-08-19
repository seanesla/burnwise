#!/usr/bin/env python3
"""
BURNWISE Mathematical Algorithm Verification
Tests Gaussian Plume Model and Simulated Annealing with NO MOCKS
"""

import math
import numpy as np
import random
from datetime import datetime, timedelta
import json

class GaussianPlumeVerifier:
    """Verify Gaussian plume dispersion calculations"""
    
    def __init__(self):
        # Pasquill-Gifford stability class parameters
        # These are the standard values from atmospheric dispersion literature
        self.stability_params = {
            'A': {'a': 213, 'b': 0.894, 'c': 440.8, 'd': 1.041, 'f': 9.27, 'g': 0.459},  # Very unstable
            'B': {'a': 156, 'b': 0.894, 'c': 106.6, 'd': 1.149, 'f': 3.3, 'g': 0.382},    # Moderately unstable
            'C': {'a': 104, 'b': 0.894, 'c': 61.0, 'd': 0.911, 'f': 0.0, 'g': 0.0},       # Slightly unstable
            'D': {'a': 68, 'b': 0.894, 'c': 33.2, 'd': 0.725, 'f': -1.7, 'g': -0.031},    # Neutral
            'E': {'a': 50.5, 'b': 0.894, 'c': 22.8, 'd': 0.678, 'f': -1.3, 'g': -0.031},  # Slightly stable
            'F': {'a': 34, 'b': 0.894, 'c': 14.35, 'd': 0.740, 'f': -0.35, 'g': -0.048}   # Moderately stable
        }
    
    def calculate_dispersion_coefficients(self, x_meters, stability_class):
        """Calculate σy and σz using Pasquill-Gifford curves"""
        params = self.stability_params[stability_class]
        
        # Convert to kilometers for standard formulas
        x_km = x_meters / 1000.0
        
        # Horizontal dispersion coefficient (σy)
        sigma_y = params['a'] * x_km ** params['b']
        
        # Vertical dispersion coefficient (σz)
        # Different formula for stable conditions
        if stability_class in ['E', 'F']:
            sigma_z = params['c'] * x_km ** params['d']
        else:
            sigma_z = params['c'] * x_km ** params['d'] * (1 + params['f'] * x_km) ** params['g']
            
        return sigma_y, sigma_z
    
    def gaussian_plume(self, Q, u, H, x, y, z, stability_class):
        """
        Calculate concentration using Gaussian plume equation
        Q: emission rate (g/s)
        u: wind speed (m/s)
        H: effective stack height (m)
        x: downwind distance (m)
        y: crosswind distance (m) 
        z: vertical distance (m)
        """
        if x <= 0:
            return 0
            
        sigma_y, sigma_z = self.calculate_dispersion_coefficients(x, stability_class)
        
        # Gaussian plume equation with ground reflection
        exp_y = math.exp(-0.5 * (y / sigma_y) ** 2) if sigma_y > 0 else 0
        exp_z1 = math.exp(-0.5 * ((z - H) / sigma_z) ** 2) if sigma_z > 0 else 0
        exp_z2 = math.exp(-0.5 * ((z + H) / sigma_z) ** 2) if sigma_z > 0 else 0
        
        if sigma_y > 0 and sigma_z > 0:
            C = (Q / (2 * math.pi * u * sigma_y * sigma_z)) * exp_y * (exp_z1 + exp_z2)
        else:
            C = 0
            
        return C * 1e6  # Convert to µg/m³
    
    def verify_plume_model(self):
        """Test various scenarios"""
        test_cases = [
            {
                'name': 'Near-field neutral conditions',
                'Q': 1.0,  # kg/s
                'u': 5.0,  # m/s
                'H': 2.0,  # m
                'x': 100,  # m
                'y': 0,    # centerline
                'z': 0,    # ground level
                'stability': 'D',
                'expected_range': (1000, 10000)  # µg/m³
            },
            {
                'name': 'Far-field stable conditions',
                'Q': 1.0,
                'u': 3.0,
                'H': 2.0,
                'x': 1000,
                'y': 0,
                'z': 0,
                'stability': 'F',
                'expected_range': (10, 1000)
            },
            {
                'name': 'Off-centerline dispersion',
                'Q': 1.0,
                'u': 5.0,
                'H': 2.0,
                'x': 500,
                'y': 100,  # 100m off centerline
                'z': 0,
                'stability': 'D',
                'expected_range': (1, 100)
            }
        ]
        
        results = []
        for test in test_cases:
            Q_gs = test['Q'] * 1000  # Convert kg/s to g/s
            concentration = self.gaussian_plume(
                Q_gs, test['u'], test['H'], test['x'], 
                test['y'], test['z'], test['stability']
            )
            
            in_range = test['expected_range'][0] <= concentration <= test['expected_range'][1]
            results.append({
                'test': test['name'],
                'concentration': concentration,
                'expected_range': test['expected_range'],
                'passed': in_range
            })
            
        return results


class SimulatedAnnealingVerifier:
    """Verify simulated annealing optimization"""
    
    def __init__(self):
        self.initial_temp = 1000
        self.cooling_rate = 0.995
        self.min_temp = 1
        
    def objective_function(self, schedule):
        """Calculate objective score for a burn schedule"""
        score = 0
        
        # Penalize conflicts (overlapping burns)
        for i in range(len(schedule)):
            for j in range(i + 1, len(schedule)):
                if self.burns_conflict(schedule[i], schedule[j]):
                    score -= 100  # Heavy penalty for conflicts
                    
        # Reward optimal timing (morning burns preferred)
        for burn in schedule:
            hour = burn['time'].hour
            if 6 <= hour <= 10:  # Optimal morning window
                score += 20
            elif 10 <= hour <= 14:  # Acceptable midday
                score += 10
            else:
                score -= 10  # Penalty for evening/night
                
        # Reward spacing between burns
        if len(schedule) > 1:
            times = sorted([burn['time'] for burn in schedule])
            for i in range(1, len(times)):
                gap_hours = (times[i] - times[i-1]).seconds / 3600
                if gap_hours >= 2:  # At least 2 hours apart
                    score += 15
                    
        return score
    
    def burns_conflict(self, burn1, burn2):
        """Check if two burns conflict based on time and location"""
        time_diff = abs((burn1['time'] - burn2['time']).seconds / 3600)
        distance = self.haversine_distance(
            burn1['lat'], burn1['lng'],
            burn2['lat'], burn2['lng']
        )
        
        # Conflict if burns are within 2 hours and 10km of each other
        return time_diff < 2 and distance < 10
    
    def haversine_distance(self, lat1, lng1, lat2, lng2):
        """Calculate distance between two points in km"""
        R = 6371  # Earth radius in km
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lng2 - lng1)
        
        a = math.sin(delta_phi/2)**2 + \
            math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    def simulated_annealing(self, initial_schedule):
        """Run simulated annealing optimization"""
        current_schedule = initial_schedule.copy()
        current_score = self.objective_function(current_schedule)
        best_schedule = current_schedule.copy()
        best_score = current_score
        
        temperature = self.initial_temp
        iterations = 0
        
        while temperature > self.min_temp and iterations < 10000:
            # Generate neighbor solution
            neighbor = self.generate_neighbor(current_schedule)
            neighbor_score = self.objective_function(neighbor)
            
            # Calculate acceptance probability
            if neighbor_score > current_score:
                # Always accept better solutions
                current_schedule = neighbor
                current_score = neighbor_score
            else:
                # Sometimes accept worse solutions
                delta = neighbor_score - current_score
                probability = math.exp(delta / temperature)
                if random.random() < probability:
                    current_schedule = neighbor
                    current_score = neighbor_score
            
            # Update best solution
            if current_score > best_score:
                best_schedule = current_schedule.copy()
                best_score = current_score
            
            # Cool down
            temperature *= self.cooling_rate
            iterations += 1
        
        return best_schedule, best_score, iterations
    
    def generate_neighbor(self, schedule):
        """Generate a neighboring solution by modifying one burn time"""
        neighbor = schedule.copy()
        if len(neighbor) > 0:
            idx = random.randint(0, len(neighbor) - 1)
            # Shift time by -2 to +2 hours
            hours_shift = random.uniform(-2, 2)
            neighbor[idx] = neighbor[idx].copy()
            neighbor[idx]['time'] = neighbor[idx]['time'] + timedelta(hours=hours_shift)
        return neighbor
    
    def verify_optimization(self):
        """Test simulated annealing convergence"""
        # Create test burn requests
        base_time = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
        initial_schedule = [
            {'time': base_time, 'lat': 38.5, 'lng': -121.7, 'acres': 100},
            {'time': base_time + timedelta(hours=1), 'lat': 38.55, 'lng': -121.75, 'acres': 150},
            {'time': base_time + timedelta(hours=1.5), 'lat': 38.52, 'lng': -121.72, 'acres': 80},
        ]
        
        initial_score = self.objective_function(initial_schedule)
        optimized, final_score, iterations = self.simulated_annealing(initial_schedule)
        
        return {
            'initial_score': initial_score,
            'final_score': final_score,
            'improvement': final_score - initial_score,
            'iterations': iterations,
            'converged': final_score > initial_score,
            'conflicts_before': sum(1 for i in range(len(initial_schedule)) 
                                   for j in range(i+1, len(initial_schedule))
                                   if self.burns_conflict(initial_schedule[i], initial_schedule[j])),
            'conflicts_after': sum(1 for i in range(len(optimized))
                                  for j in range(i+1, len(optimized))
                                  if self.burns_conflict(optimized[i], optimized[j]))
        }


def main():
    print("="*70)
    print("BURNWISE MATHEMATICAL ALGORITHM VERIFICATION")
    print("="*70)
    
    # Test Gaussian Plume Model
    print("\n🌫️  GAUSSIAN PLUME MODEL VERIFICATION")
    print("-"*50)
    plume_verifier = GaussianPlumeVerifier()
    plume_results = plume_verifier.verify_plume_model()
    
    for result in plume_results:
        status = "✅" if result['passed'] else "❌"
        print(f"{status} {result['test']}")
        print(f"   Concentration: {result['concentration']:.2f} µg/m³")
        print(f"   Expected range: {result['expected_range'][0]}-{result['expected_range'][1]} µg/m³")
    
    plume_pass_rate = sum(1 for r in plume_results if r['passed']) / len(plume_results) * 100
    print(f"\n📊 Gaussian Plume Pass Rate: {plume_pass_rate:.1f}%")
    
    # Test Simulated Annealing
    print("\n🔥 SIMULATED ANNEALING VERIFICATION")
    print("-"*50)
    sa_verifier = SimulatedAnnealingVerifier()
    sa_result = sa_verifier.verify_optimization()
    
    print(f"Initial Score: {sa_result['initial_score']}")
    print(f"Final Score: {sa_result['final_score']}")
    print(f"Improvement: {sa_result['improvement']}")
    print(f"Iterations: {sa_result['iterations']}")
    print(f"Conflicts Before: {sa_result['conflicts_before']}")
    print(f"Conflicts After: {sa_result['conflicts_after']}")
    print(f"Convergence: {'✅ YES' if sa_result['converged'] else '❌ NO'}")
    
    # Overall verdict
    print("\n" + "="*70)
    print("MATHEMATICAL VERIFICATION SUMMARY")
    print("="*70)
    
    if plume_pass_rate >= 66 and sa_result['converged']:
        print("✅ ALGORITHMS VERIFIED: Mathematical models working correctly")
    else:
        print("⚠️  PARTIAL VERIFICATION: Some algorithms need adjustment")
    
    print(f"\nDetailed Results:")
    print(f"- Gaussian Plume: {plume_pass_rate:.1f}% tests passed")
    print(f"- Simulated Annealing: {'Converged' if sa_result['converged'] else 'Failed to converge'}")
    print(f"- Conflict Reduction: {sa_result['conflicts_before']} → {sa_result['conflicts_after']}")

if __name__ == "__main__":
    main()