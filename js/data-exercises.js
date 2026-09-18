/* ==========================================================================
   FitLog — Exercise library
   Grouped into the three training sections: Upper Body, Lower Body, Cardio.
   met  = Metabolic Equivalent of Task, used for energy-expenditure estimates
          kcal/min = MET x 3.5 x bodyweightKg / 200   (Compendium of Physical
          Activities standard equation)
   eq   = equipment
   mode = 'strength'  -> logged as weight x reps (+ RPE, rest)
          'bodyweight'-> logged as reps (+ optional added weight)
          'time'      -> logged as duration (+ optional weight, e.g. plank)
          'cardio'    -> logged as duration / distance / avg HR / intensity
   ========================================================================== */

const EX_LIB = {
  upper: {
    id: 'upper',
    label: 'Upper Body',
    icon: 'upper',
    blurb: 'Chest, back, shoulders, arms and core',
    groups: [
      {
        id: 'chest', name: 'Chest', ex: [
          { n: 'Barbell Bench Press', eq: 'Barbell', mode: 'strength', met: 6 },
          { n: 'Incline Barbell Bench Press', eq: 'Barbell', mode: 'strength', met: 6 },
          { n: 'Decline Barbell Bench Press', eq: 'Barbell', mode: 'strength', met: 6 },
          { n: 'Dumbbell Bench Press', eq: 'Dumbbell', mode: 'strength', met: 6 },
          { n: 'Incline Dumbbell Press', eq: 'Dumbbell', mode: 'strength', met: 6 },
          { n: 'Decline Dumbbell Press', eq: 'Dumbbell', mode: 'strength', met: 6 },
          { n: 'Dumbbell Fly', eq: 'Dumbbell', mode: 'strength', met: 5 },
          { n: 'Incline Dumbbell Fly', eq: 'Dumbbell', mode: 'strength', met: 5 },
          { n: 'Cable Crossover (High to Low)', eq: 'Cable', mode: 'strength', met: 5 },
          { n: 'Cable Crossover (Low to High)', eq: 'Cable', mode: 'strength', met: 5 },
          { n: 'Pec Deck / Machine Fly', eq: 'Machine', mode: 'strength', met: 5 },
          { n: 'Chest Press Machine', eq: 'Machine', mode: 'strength', met: 5 },
          { n: 'Smith Machine Bench Press', eq: 'Machine', mode: 'strength', met: 6 },
          { n: 'Push-Up', eq: 'Bodyweight', mode: 'bodyweight', met: 5 },
          { n: 'Incline Push-Up', eq: 'Bodyweight', mode: 'bodyweight', met: 4 },
          { n: 'Decline Push-Up', eq: 'Bodyweight', mode: 'bodyweight', met: 5.5 },
          { n: 'Chest Dip', eq: 'Bodyweight', mode: 'bodyweight', met: 6 },
          { n: 'Svend Press', eq: 'Plate', mode: 'strength', met: 4 }
        ]
      },
      {
        id: 'back', name: 'Back', ex: [
          { n: 'Deadlift (Conventional)', eq: 'Barbell', mode: 'strength', met: 6 },
          { n: 'Rack Pull', eq: 'Barbell', mode: 'strength', met: 6 },
          { n: 'Barbell Bent-Over Row', eq: 'Barbell', mode: 'strength', met: 6 },
          { n: 'Pendlay Row', eq: 'Barbell', mode: 'strength', met: 6 },
          { n: 'T-Bar Row', eq: 'Barbell', mode: 'strength', met: 6 },
          { n: 'Dumbbell Row (Single Arm)', eq: 'Dumbbell', mode: 'strength', met: 5.5 },
          { n: 'Chest-Supported Dumbbell Row', eq: 'Dumbbell', mode: 'strength', met: 5.5 },
          { n: 'Seated Cable Row', eq: 'Cable', mode: 'strength', met: 5 },
          { n: 'Lat Pulldown (Wide Grip)', eq: 'Cable', mode: 'strength', met: 5 },
          { n: 'Lat Pulldown (Close Grip)', eq: 'Cable', mode: 'strength', met: 5 },
          { n: 'Straight-Arm Pulldown', eq: 'Cable', mode: 'strength', met: 4.5 },
          { n: 'Cable Face Pull', eq: 'Cable', mode: 'strength', met: 4.5 },
          { n: 'Pull-Up', eq: 'Bodyweight', mode: 'bodyweight', met: 8 },
          { n: 'Chin-Up', eq: 'Bodyweight', mode: 'bodyweight', met: 8 },
          { n: 'Inverted Row', eq: 'Bodyweight', mode: 'bodyweight', met: 5 },
          { n: 'Machine Row', eq: 'Machine', mode: 'strength', met: 5 },
          { n: 'Back Extension / Hyperextension', eq: 'Bodyweight', mode: 'bodyweight', met: 4 },
          { n: 'Good Morning', eq: 'Barbell', mode: 'strength', met: 5 }
        ]
      },
      {
        id: 'shoulders', name: 'Shoulders', ex: [
          { n: 'Overhead Press (Barbell)', eq: 'Barbell', mode: 'strength', met: 6 },
          { n: 'Seated Dumbbell Shoulder Press', eq: 'Dumbbell', mode: 'strength', met: 5.5 },
          { n: 'Arnold Press', eq: 'Dumbbell', mode: 'strength', met: 5.5 },
          { n: 'Push Press', eq: 'Barbell', mode: 'strength', met: 6.5 },
          { n: 'Machine Shoulder Press', eq: 'Machine', mode: 'strength', met: 5 },
          { n: 'Dumbbell Lateral Raise', eq: 'Dumbbell', mode: 'strength', met: 4.5 },
          { n: 'Cable Lateral Raise', eq: 'Cable', mode: 'strength', met: 4.5 },
          { n: 'Dumbbell Front Raise', eq: 'Dumbbell', mode: 'strength', met: 4.5 },
          { n: 'Rear Delt Fly (Dumbbell)', eq: 'Dumbbell', mode: 'strength', met: 4.5 },
          { n: 'Reverse Pec Deck', eq: 'Machine', mode: 'strength', met: 4.5 },
          { n: 'Upright Row', eq: 'Barbell', mode: 'strength', met: 5 },
          { n: 'Landmine Press', eq: 'Barbell', mode: 'strength', met: 5.5 }
        ]
      },
      {
        id: 'traps', name: 'Traps & Neck', ex: [
          { n: 'Barbell Shrug', eq: 'Barbell', mode: 'strength', met: 5 },
          { n: 'Dumbbell Shrug', eq: 'Dumbbell', mode: 'strength', met: 5 },
          { n: 'Cable Shrug', eq: 'Cable', mode: 'strength', met: 4.5 },
          { n: 'Farmer’s Carry', eq: 'Dumbbell', mode: 'time', met: 6 },
          { n: 'Neck Curl / Extension', eq: 'Plate', mode: 'strength', met: 3.5 }
        ]
      },
      {
        id: 'biceps', name: 'Biceps', ex: [
          { n: 'Barbell Curl', eq: 'Barbell', mode: 'strength', met: 4.5 },
          { n: 'EZ-Bar Curl', eq: 'Barbell', mode: 'strength', met: 4.5 },
          { n: 'Dumbbell Curl', eq: 'Dumbbell', mode: 'strength', met: 4.5 },
          { n: 'Hammer Curl', eq: 'Dumbbell', mode: 'strength', met: 4.5 },
          { n: 'Incline Dumbbell Curl', eq: 'Dumbbell', mode: 'strength', met: 4.5 },
          { n: 'Preacher Curl', eq: 'Barbell', mode: 'strength', met: 4.5 },
          { n: 'Concentration Curl', eq: 'Dumbbell', mode: 'strength', met: 4 },
          { n: 'Cable Curl', eq: 'Cable', mode: 'strength', met: 4.5 },
          { n: 'Spider Curl', eq: 'Dumbbell', mode: 'strength', met: 4 }
        ]
      },
      {
        id: 'triceps', name: 'Triceps', ex: [
          { n: 'Close-Grip Bench Press', eq: 'Barbell', mode: 'strength', met: 6 },
          { n: 'Skull Crusher (Lying Extension)', eq: 'Barbell', mode: 'strength', met: 5 },
          { n: 'Overhead Dumbbell Extension', eq: 'Dumbbell', mode: 'strength', met: 4.5 },
          { n: 'Cable Pushdown (Bar)', eq: 'Cable', mode: 'strength', met: 4.5 },
          { n: 'Cable Pushdown (Rope)', eq: 'Cable', mode: 'strength', met: 4.5 },
          { n: 'Overhead Cable Extension', eq: 'Cable', mode: 'strength', met: 4.5 },
          { n: 'Triceps Dip', eq: 'Bodyweight', mode: 'bodyweight', met: 6 },
          { n: 'Bench Dip', eq: 'Bodyweight', mode: 'bodyweight', met: 5 },
          { n: 'Diamond Push-Up', eq: 'Bodyweight', mode: 'bodyweight', met: 5.5 },
          { n: 'Kickback', eq: 'Dumbbell', mode: 'strength', met: 4 }
        ]
      },
      {
        id: 'forearms', name: 'Forearms & Grip', ex: [
          { n: 'Wrist Curl', eq: 'Barbell', mode: 'strength', met: 3.5 },
          { n: 'Reverse Wrist Curl', eq: 'Barbell', mode: 'strength', met: 3.5 },
          { n: 'Reverse Curl', eq: 'Barbell', mode: 'strength', met: 4 },
          { n: 'Dead Hang', eq: 'Bodyweight', mode: 'time', met: 4 },
          { n: 'Plate Pinch Hold', eq: 'Plate', mode: 'time', met: 4 }
        ]
      },
      {
        id: 'core', name: 'Core & Abs', ex: [
          { n: 'Plank', eq: 'Bodyweight', mode: 'time', met: 3.8 },
          { n: 'Side Plank', eq: 'Bodyweight', mode: 'time', met: 3.8 },
          { n: 'Hanging Leg Raise', eq: 'Bodyweight', mode: 'bodyweight', met: 5 },
          { n: 'Captain’s Chair Knee Raise', eq: 'Bodyweight', mode: 'bodyweight', met: 4.5 },
          { n: 'Cable Crunch', eq: 'Cable', mode: 'strength', met: 4 },
          { n: 'Crunch', eq: 'Bodyweight', mode: 'bodyweight', met: 3.8 },
          { n: 'Bicycle Crunch', eq: 'Bodyweight', mode: 'bodyweight', met: 4.5 },
          { n: 'Russian Twist', eq: 'Plate', mode: 'bodyweight', met: 4 },
          { n: 'Ab Wheel Rollout', eq: 'Other', mode: 'bodyweight', met: 5 },
          { n: 'Dead Bug', eq: 'Bodyweight', mode: 'bodyweight', met: 3.5 },
          { n: 'Mountain Climber', eq: 'Bodyweight', mode: 'time', met: 8 },
          { n: 'Pallof Press', eq: 'Cable', mode: 'strength', met: 4 }
        ]
      }
    ]
  },

  lower: {
    id: 'lower',
    label: 'Lower Body',
    icon: 'lower',
    blurb: 'Quads, hamstrings, glutes, calves and hips',
    groups: [
      {
        id: 'quads', name: 'Quadriceps', ex: [
          { n: 'Back Squat', eq: 'Barbell', mode: 'strength', met: 6 },
          { n: 'Front Squat', eq: 'Barbell', mode: 'strength', met: 6 },
          { n: 'Box Squat', eq: 'Barbell', mode: 'strength', met: 5.5 },
          { n: 'Smith Machine Squat', eq: 'Machine', mode: 'strength', met: 5.5 },
          { n: 'Hack Squat', eq: 'Machine', mode: 'strength', met: 5.5 },
          { n: 'Leg Press', eq: 'Machine', mode: 'strength', met: 5.5 },
          { n: 'Goblet Squat', eq: 'Dumbbell', mode: 'strength', met: 5 },
          { n: 'Bulgarian Split Squat', eq: 'Dumbbell', mode: 'strength', met: 5.5 },
          { n: 'Walking Lunge', eq: 'Dumbbell', mode: 'strength', met: 6 },
          { n: 'Reverse Lunge', eq: 'Dumbbell', mode: 'strength', met: 5.5 },
          { n: 'Step-Up', eq: 'Dumbbell', mode: 'strength', met: 5.5 },
          { n: 'Leg Extension', eq: 'Machine', mode: 'strength', met: 4.5 },
          { n: 'Sissy Squat', eq: 'Bodyweight', mode: 'bodyweight', met: 5 },
          { n: 'Wall Sit', eq: 'Bodyweight', mode: 'time', met: 4 }
        ]
      },
      {
        id: 'hamstrings', name: 'Hamstrings', ex: [
          { n: 'Romanian Deadlift', eq: 'Barbell', mode: 'strength', met: 6 },
          { n: 'Stiff-Leg Deadlift', eq: 'Barbell', mode: 'strength', met: 6 },
          { n: 'Dumbbell Romanian Deadlift', eq: 'Dumbbell', mode: 'strength', met: 5.5 },
          { n: 'Single-Leg RDL', eq: 'Dumbbell', mode: 'strength', met: 5 },
          { n: 'Lying Leg Curl', eq: 'Machine', mode: 'strength', met: 4.5 },
          { n: 'Seated Leg Curl', eq: 'Machine', mode: 'strength', met: 4.5 },
          { n: 'Nordic Hamstring Curl', eq: 'Bodyweight', mode: 'bodyweight', met: 5 },
          { n: 'Glute-Ham Raise', eq: 'Machine', mode: 'bodyweight', met: 5 },
          { n: 'Cable Pull-Through', eq: 'Cable', mode: 'strength', met: 5 }
        ]
      },
      {
        id: 'glutes', name: 'Glutes', ex: [
          { n: 'Barbell Hip Thrust', eq: 'Barbell', mode: 'strength', met: 5.5 },
          { n: 'Glute Bridge', eq: 'Bodyweight', mode: 'bodyweight', met: 4 },
          { n: 'Single-Leg Hip Thrust', eq: 'Bodyweight', mode: 'bodyweight', met: 4.5 },
          { n: 'Cable Kickback', eq: 'Cable', mode: 'strength', met: 4 },
          { n: 'Hip Abduction Machine', eq: 'Machine', mode: 'strength', met: 4 },
          { n: 'Sumo Deadlift', eq: 'Barbell', mode: 'strength', met: 6 },
          { n: 'Curtsy Lunge', eq: 'Dumbbell', mode: 'strength', met: 5.5 },
          { n: 'Banded Lateral Walk', eq: 'Band', mode: 'time', met: 4 }
        ]
      },
      {
        id: 'calves', name: 'Calves', ex: [
          { n: 'Standing Calf Raise', eq: 'Machine', mode: 'strength', met: 4 },
          { n: 'Seated Calf Raise', eq: 'Machine', mode: 'strength', met: 4 },
          { n: 'Leg Press Calf Raise', eq: 'Machine', mode: 'strength', met: 4 },
          { n: 'Dumbbell Calf Raise', eq: 'Dumbbell', mode: 'strength', met: 4 },
          { n: 'Single-Leg Calf Raise', eq: 'Bodyweight', mode: 'bodyweight', met: 4 },
          { n: 'Tibialis Raise', eq: 'Bodyweight', mode: 'bodyweight', met: 3.5 }
        ]
      },
      {
        id: 'adductors', name: 'Adductors & Hips', ex: [
          { n: 'Hip Adduction Machine', eq: 'Machine', mode: 'strength', met: 4 },
          { n: 'Copenhagen Plank', eq: 'Bodyweight', mode: 'time', met: 4 },
          { n: 'Cossack Squat', eq: 'Bodyweight', mode: 'bodyweight', met: 5 },
          { n: 'Sumo Squat', eq: 'Dumbbell', mode: 'strength', met: 5.5 },
          { n: '90/90 Hip Switch', eq: 'Bodyweight', mode: 'time', met: 3 }
        ]
      },
      {
        id: 'power', name: 'Olympic & Power', ex: [
          { n: 'Power Clean', eq: 'Barbell', mode: 'strength', met: 8 },
          { n: 'Hang Clean', eq: 'Barbell', mode: 'strength', met: 8 },
          { n: 'Clean & Jerk', eq: 'Barbell', mode: 'strength', met: 8 },
          { n: 'Snatch', eq: 'Barbell', mode: 'strength', met: 8 },
          { n: 'Kettlebell Swing', eq: 'Kettlebell', mode: 'strength', met: 9.8 },
          { n: 'Box Jump', eq: 'Bodyweight', mode: 'bodyweight', met: 8 },
          { n: 'Broad Jump', eq: 'Bodyweight', mode: 'bodyweight', met: 7 },
          { n: 'Trap Bar Deadlift', eq: 'Barbell', mode: 'strength', met: 6 }
        ]
      }
    ]
  },

  cardio: {
    id: 'cardio',
    label: 'Cardio',
    icon: 'cardio',
    blurb: 'Conditioning, endurance and recovery work',
    groups: [
      {
        id: 'running', name: 'Running & Walking', ex: [
          { n: 'Treadmill Walk (5 km/h)', eq: 'Treadmill', mode: 'cardio', met: 3.5 },
          { n: 'Brisk Walk (6 km/h)', eq: 'Outdoor', mode: 'cardio', met: 4.3 },
          { n: 'Incline Treadmill Walk', eq: 'Treadmill', mode: 'cardio', met: 6.0 },
          { n: 'Jog (8 km/h)', eq: 'Outdoor', mode: 'cardio', met: 8.3 },
          { n: 'Run (10 km/h)', eq: 'Outdoor', mode: 'cardio', met: 9.8 },
          { n: 'Run (12 km/h)', eq: 'Outdoor', mode: 'cardio', met: 11.8 },
          { n: 'Run (14 km/h)', eq: 'Outdoor', mode: 'cardio', met: 14.5 },
          { n: 'Sprint Intervals', eq: 'Outdoor', mode: 'cardio', met: 14.0 },
          { n: 'Trail Run / Hike', eq: 'Outdoor', mode: 'cardio', met: 7.0 }
        ]
      },
      {
        id: 'cycling', name: 'Cycling', ex: [
          { n: 'Stationary Bike (Light)', eq: 'Bike', mode: 'cardio', met: 5.5 },
          { n: 'Stationary Bike (Moderate)', eq: 'Bike', mode: 'cardio', met: 7.0 },
          { n: 'Stationary Bike (Vigorous)', eq: 'Bike', mode: 'cardio', met: 10.5 },
          { n: 'Spin Class', eq: 'Bike', mode: 'cardio', met: 8.5 },
          { n: 'Outdoor Cycling (16-19 km/h)', eq: 'Outdoor', mode: 'cardio', met: 6.8 },
          { n: 'Outdoor Cycling (20-25 km/h)', eq: 'Outdoor', mode: 'cardio', met: 10.0 },
          { n: 'Assault / Air Bike', eq: 'Bike', mode: 'cardio', met: 9.0 }
        ]
      },
      {
        id: 'machines', name: 'Cardio Machines', ex: [
          { n: 'Rowing Machine (Moderate)', eq: 'Rower', mode: 'cardio', met: 7.0 },
          { n: 'Rowing Machine (Vigorous)', eq: 'Rower', mode: 'cardio', met: 8.5 },
          { n: 'Elliptical (Moderate)', eq: 'Elliptical', mode: 'cardio', met: 5.0 },
          { n: 'Elliptical (Vigorous)', eq: 'Elliptical', mode: 'cardio', met: 7.5 },
          { n: 'Stair Climber', eq: 'Stepper', mode: 'cardio', met: 9.0 },
          { n: 'SkiErg', eq: 'Other', mode: 'cardio', met: 8.0 },
          { n: 'Ski / Curved Treadmill', eq: 'Treadmill', mode: 'cardio', met: 9.5 }
        ]
      },
      {
        id: 'conditioning', name: 'Conditioning & Classes', ex: [
          { n: 'HIIT Circuit', eq: 'Mixed', mode: 'cardio', met: 8.0 },
          { n: 'Circuit Training (General)', eq: 'Mixed', mode: 'cardio', met: 7.0 },
          { n: 'CrossFit / Metcon WOD', eq: 'Mixed', mode: 'cardio', met: 9.0 },
          { n: 'Jump Rope', eq: 'Rope', mode: 'cardio', met: 11.0 },
          { n: 'Battle Ropes', eq: 'Rope', mode: 'cardio', met: 8.0 },
          { n: 'Sled Push / Prowler', eq: 'Sled', mode: 'cardio', met: 9.5 },
          { n: 'Boxing / Bag Work', eq: 'Bag', mode: 'cardio', met: 7.8 },
          { n: 'Swimming (Moderate)', eq: 'Pool', mode: 'cardio', met: 7.0 },
          { n: 'Swimming (Vigorous Freestyle)', eq: 'Pool', mode: 'cardio', met: 10.0 },
          { n: 'Football / Soccer', eq: 'Sport', mode: 'cardio', met: 8.0 },
          { n: 'Basketball', eq: 'Sport', mode: 'cardio', met: 7.5 },
          { n: 'Badminton / Tennis', eq: 'Sport', mode: 'cardio', met: 7.0 },
          { n: 'Padel', eq: 'Sport', mode: 'cardio', met: 7.0 }
        ]
      },
      {
        id: 'recovery', name: 'Mobility & Recovery', ex: [
          { n: 'Yoga (Hatha)', eq: 'Mat', mode: 'cardio', met: 2.5 },
          { n: 'Yoga (Power / Vinyasa)', eq: 'Mat', mode: 'cardio', met: 4.0 },
          { n: 'Stretching / Mobility', eq: 'Mat', mode: 'cardio', met: 2.3 },
          { n: 'Foam Rolling', eq: 'Roller', mode: 'cardio', met: 2.3 },
          { n: 'Easy Recovery Walk', eq: 'Outdoor', mode: 'cardio', met: 3.0 },
          { n: 'Sauna / Steam', eq: 'Other', mode: 'cardio', met: 1.5 }
        ]
      }
    ]
  }
};

/* Flat index for search: [{section, groupId, groupName, name, eq, mode, met}] */
const EX_FLAT = (() => {
  const out = [];
  Object.values(EX_LIB).forEach(sec => {
    sec.groups.forEach(g => {
      g.ex.forEach(e => out.push({
        section: sec.id, sectionLabel: sec.label,
        groupId: g.id, groupName: g.name,
        name: e.n, eq: e.eq, mode: e.mode, met: e.met
      }));
    });
  });
  return out;
})();

const EX_BY_NAME = (() => {
  const m = {};
  EX_FLAT.forEach(e => { m[e.name] = e; });
  return m;
})();
