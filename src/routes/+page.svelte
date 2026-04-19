<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';

  let status = $state('');
  let isWriting = $state(false);
  let dirHandle: FileSystemDirectoryHandle | null = $state(null);

  const VAULT_FILES: Record<string, string> = {
    'ebr-mod.json': JSON.stringify(
      {
        name: 'Spike Test Vault',
        id: 'spike-test-vault',
        version: '0.1.0',
        type: 'custom-campaign',
        description: 'A minimal vault to verify the storage pipeline.',
        author: 'EBR Mod Manager',
        campaigns: ['test'],
        requiredProducts: ['core-set'],
        baseVersion: '1.0.0',
        safeToAddMidCampaign: true,
        language: 'en',
        repoUrl: '',
      },
      null,
      2,
    ),
    'Welcome.md': '# Welcome\n\nThis vault was created by the EBR Mod Manager storage spike.\n',
  };

  async function writeFile(dir: FileSystemDirectoryHandle, name: string, content: string) {
    const fileHandle = await dir.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async function writeTestVault() {
    isWriting = true;
    status = '';
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      dirHandle = handle;

      for (const [name, content] of Object.entries(VAULT_FILES)) {
        await writeFile(handle, name, content);
      }

      status = m.spike_success({ path: handle.name });
    } catch (e: any) {
      if (e.name === 'AbortError') {
        status = ''; // user cancelled picker
      } else {
        status = m.spike_error({ message: String(e) });
      }
    } finally {
      isWriting = false;
    }
  }

  async function checkTestVault() {
    status = '';
    try {
      const handle = dirHandle ?? (await window.showDirectoryPicker({ mode: 'read' }));
      dirHandle = handle;

      try {
        await handle.getFileHandle('ebr-mod.json');
        status = m.spike_exists({ path: handle.name });
      } catch {
        status = m.spike_not_found();
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        status = '';
      } else {
        status = m.spike_error({ message: String(e) });
      }
    }
  }
</script>

<main class="container">
  <h1>{m.app_title()}</h1>

  <section class="spike">
    <h2>{m.spike_title()}</h2>
    <p>{m.spike_description()}</p>

    <div class="buttons">
      <button onclick={writeTestVault} disabled={isWriting}>
        {isWriting ? m.downloading() : m.spike_write_button()}
      </button>
      <button onclick={checkTestVault}>
        {m.spike_check_button()}
      </button>
    </div>

    {#if status}
      <pre class="status">{status}</pre>
    {/if}
  </section>
</main>

<style>
:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;

  color: #0f0f0f;
  background-color: #f6f6f6;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

.container {
  margin: 0 auto;
  max-width: 600px;
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  text-align: center;
}

h1 {
  text-align: center;
  margin-bottom: 2rem;
}

.spike {
  text-align: left;
}

.spike p {
  margin-bottom: 1.5rem;
  color: #555;
}

.buttons {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  background: #24c8db;
  color: #fff;
  font-weight: 600;
  min-height: 48px; /* touch-friendly */
}

button:hover {
  background: #1aa8b8;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #1a1a2e;
  color: #0f0;
  border-radius: 6px;
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-break: break-all;
}

@media (prefers-color-scheme: dark) {
  :root {
    color: #f6f6f6;
    background-color: #2f2f2f;
  }

  .spike p {
    color: #aaa;
  }
}
</style>
