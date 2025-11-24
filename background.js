chrome.runtime.onInstalled.addListener(async () => {
  console.log('Gerenciador de URLs v2.0 instalado com sucesso!');

  try {
    const result = await chrome.storage.local.get(['urls']);
    const urls = result.urls || [];

    if (urls.length > 0) {
      const urlsWithIds = urls.map((url, index) => ({
        ...url,
        id: url.id || `url_${Date.now()}_${index}`
      }));
      await chrome.storage.local.set({ urls: urlsWithIds });
      console.log('IDs adicionados a', urlsWithIds.length, 'URLs');
    }
  } catch (error) {
    console.error('Erro na migração:', error);
  }
});