import {createContext} from 'react';
/** Let the settings window dismiss its active child before dismissing itself. */
export const NestedSettingsDialog=createContext<((dismiss:()=>void)=>()=>void)|null>(null);
