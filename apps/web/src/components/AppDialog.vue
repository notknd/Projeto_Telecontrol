<script setup lang="ts">
import { ref, onMounted } from "vue";
defineProps<{ labelledby: string; busy: boolean }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
onMounted(() => dialog.value?.showModal());
</script>
<template>
  <dialog
    ref="dialog"
    class="modal"
    :aria-labelledby="labelledby"
    @cancel.prevent="!busy && emit('close')"
  >
    <slot />
  </dialog>
</template>
