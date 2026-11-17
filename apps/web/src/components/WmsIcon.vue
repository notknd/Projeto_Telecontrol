<script setup lang="ts">
import { ICONS } from "../icons";
defineProps<{ name: string; size?: number }>();
</script>
<template>
  <svg
    class="ico"
    viewBox="0 0 24 24"
    :style="size ? { width: `${size}px`, height: `${size}px` } : {}"
    aria-hidden="true"
    v-html="ICONS[name] || ICONS.products"
  ></svg>
</template>
