import React from 'react';

export const EfectivoIcon = ({ className = "w-5 h-5 inline-block mr-1 align-middle" }) => (
    <svg className={className} viewBox="0 0 600 350" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="600" height="350" fill="#4CBA54"/>
        <path d="M 80 40 L 520 40 A 40 40 0 0 0 560 80 L 560 270 A 40 40 0 0 0 520 310 L 80 310 A 40 40 0 0 0 40 270 L 40 80 A 40 40 0 0 0 80 40 Z" fill="#0C7B42" />
        <circle cx="140" cy="175" r="35" fill="#4CBA54" />
        <circle cx="460" cy="175" r="35" fill="#4CBA54" />
        <circle cx="300" cy="175" r="90" fill="#4CBA54" />
        <text x="300" y="240" fill="#0C7B42" fontSize="180" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">$</text>
    </svg>
);

export const YapeIcon = ({ className = "w-5 h-5 inline-block mr-1 align-middle" }) => (
    <svg className={className} viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="400" rx="100" fill="#742384"/>
        <path d="M220 120 A 40 40 0 1 0 150 170 L 150 210 L 180 185 A 40 40 0 0 0 220 120" fill="#00E676"/>
        <text x="175" y="165" fill="white" fontSize="45" fontWeight="bold" fontFamily="sans-serif">S/</text>
        <text x="200" y="275" fill="white" fontSize="120" fontWeight="bold" fontStyle="italic" fontFamily="serif" textAnchor="middle">yape</text>
    </svg>
);

export const PlinIcon = ({ className = "w-5 h-5 inline-block mr-1 align-middle" }) => (
    <svg className={className} viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="400" rx="100" fill="#00B4B1"/>
        <text x="195" y="250" fill="white" fontSize="150" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">plin</text>
        <circle cx="265" cy="150" r="25" fill="#E6007E"/>
    </svg>
);

export const TarjetaIcon = ({ className = "w-5 h-5 inline-block mr-1 align-middle" }) => (
    <svg className={className} viewBox="0 0 640 400" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="160" y="40" width="460" height="290" rx="30" fill="#FFAE19"/>
        <rect x="160" y="90" width="460" height="60" fill="#444C51"/>
        
        <rect x="20" y="110" width="480" height="290" rx="30" fill="#8BBCC2"/>
        
        <rect x="70" y="180" width="80" height="60" rx="10" fill="#FFC72C"/>
        <rect x="75" y="185" width="70" height="50" rx="6" stroke="#DCA212" strokeWidth="4"/>
        <path d="M95 185 V235 M125 185 V235 M75 210 H145" stroke="#DCA212" strokeWidth="4"/>
        <rect x="95" y="195" width="30" height="30" rx="5" fill="#FFC72C" stroke="#DCA212" strokeWidth="4"/>
        
        <rect x="70" y="270" width="75" height="25" rx="6" fill="#6A979D"/>
        <rect x="165" y="270" width="75" height="25" rx="6" fill="#6A979D"/>
        <rect x="260" y="270" width="75" height="25" rx="6" fill="#6A979D"/>
        <rect x="355" y="270" width="75" height="25" rx="6" fill="#6A979D"/>
        
        <rect x="330" y="150" width="130" height="40" rx="20" fill="#FFFFFF"/>
        <rect x="70" y="320" width="160" height="25" rx="6" fill="#E8EDF0"/>
    </svg>
);
