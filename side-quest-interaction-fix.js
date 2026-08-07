(() => {
  'use strict';
  const TV = window.ToonValley;
  const quests = window.ToonValleySideQuests;
  if (!TV || !quests) return;

  ['Mochi', 'Pepper', 'Sunny'].forEach((name, index) => {
    const interaction = TV.interactables.find((entry) => entry.area === 'world' && entry.prompt === `Help ${name} get home`);
    if (!interaction) return;
    interaction.action = () => quests.startPet(index);
    interaction.userData = interaction.userData || {};
    interaction.userData.sideQuestImmediateEscort = true;
  });

  window.ToonValleySideQuestInteractionFix = Object.freeze({
    immediatePetEscorts: true,
    pets: 3
  });
})();