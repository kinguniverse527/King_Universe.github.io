import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Markdown } from '@tiptap/markdown';
import DOMPurify from 'dompurify';
import * as YAML from 'js-yaml';
import * as fflate from 'fflate';
import { marked } from 'marked';

window.BlogVendor = { Editor, StarterKit, Image, Markdown, DOMPurify, YAML, fflate, marked };
