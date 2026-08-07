(() => {
  'use strict';
  const routines = window.ToonValleyRoutines;
  if (!routines?.getCurrentErrand) return;

  const originalGetCurrentErrand = routines.getCurrentErrand;
  const sideQuestNames = Object.freeze({
    'Library Book Return': 'Library book drop',
    'Garden Seed Delivery': 'Garden seed delivery',
    'Fire Station Supply Run': 'Fire station supply check'
  });

  window.ToonValleyRoutines = Object.freeze({
    ...routines,
    getCurrentErrand: () => {
      const task = originalGetCurrentErrand();
      return {
        ...task,
        displayName: task.name,
        name: sideQuestNames[task.name] || task.name
      };
    },
    sideQuestNameCompatibility: true
  });
})();