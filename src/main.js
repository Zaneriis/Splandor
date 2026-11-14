import './style.css';
import { createApp } from './ui/app.js';

const params = new URLSearchParams(window.location.search);
const aiDelay = params.has('aiDelay') ? Number(params.get('aiDelay')) : 700;

createApp(document.getElementById('app'), { aiDelay });
