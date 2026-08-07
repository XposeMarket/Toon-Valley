(() => {
  'use strict';
  const TV=window.ToonValley,R=window.ToonValleyRoutines;
  if(!TV||!R)return;

  // side-quest-overhaul historically replaced the notice-board action. The canonical
  // routines system is now the stronger quest: accept -> pickup -> deliver -> return
  // to the board for sign-off/reward. Restore that exact lifecycle after all quest
  // modules have initialized.
  const board=TV.interactables.find(i=>i.area==='world'&&i.prompt==='Check community notice board');
  if(board)board.action=()=>R.handleNoticeBoard();

  // Disable the superseded duplicate pickup/delivery interactions from older quest
  // builds. The canonical moving blue/yellow marker interactions remain active.
  const duplicate=/^(Collect returned books from Cal|Collect seed packet from Nina|Collect fire-station supplies from Cal|Hand book bundle to Mabel|Deliver seed packet to community garden|Hand supplies to Sam)$/;
  let retired=0;
  for(const item of TV.interactables){
    if(!duplicate.test(item.prompt||''))continue;
    item.enabled=()=>false;
    if(item.object)item.object.visible=false;
    retired++;
  }

  window.ToonValleySideQuestRoutineBridge=Object.freeze({active:true,canonicalStyle:R.questStyle,retiredDuplicates:retired});
  console.info('Canonical notice-board quest restored',window.ToonValleySideQuestRoutineBridge);
})();
