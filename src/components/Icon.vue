<script setup lang="ts">
defineProps<{ name: 'image' | 'capture' | 'paste' | 'copy' | 'check' | 'close' | 'arrow' | 'file' }>()
const paths = {
  image: 'M4 4h16v16H4z M4 15l5-5 4 4 3-3 4 4 M15 8h.01',
  capture: 'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5 M8 8h8v8H8z',
  paste: 'M9 5H6a2 2 0 0 0-2 2v13h16V7a2 2 0 0 0-2-2h-3 M9 3h6v5H9z M8 12h8 M8 16h6',
  copy: 'M8 8h12v12H8z M16 8V4H4v12h4',
  check: 'M5 12l4 4L19 6',
  close: 'M6 6l12 12 M6 18L18 6',
  arrow: 'M5 12h14 M14 7l5 5-5 5',
  file: 'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h5',
}
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name]" /></svg>
</template>
