import React, { memo } from 'react';

export const BroomIcon = memo(function BroomIcon(/** @type {any} */ { className = "w-5 h-5", ...props }) {
    return (
        <svg 
            className={className} 
            width="24"
            height="24"
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            {...props}
        >
            <path d="M14 10L21 3" />
            <path d="M15 11L22 4" />
            <path d="M10 9.5C11.5 11 11.5 13 10 14.5L9.5 14L8.5 13C7 11.5 7 9.5 8.5 8L10 9.5Z" fill="currentColor" fillOpacity="0.2" />
            <path d="M8.5 13.5C6 16 3 17.5 4 20.5C6.5 21.5 9.5 20.5 12 17L10 14.5" />
            <path d="M6 16.5C7.5 17.5 9 18 10.5 18" />
            <circle cx="16" cy="14" r="1" fill="currentColor" />
            <circle cx="19" cy="11" r="1.5" />
            <circle cx="17" cy="18" r="1.2" />
            <circle cx="21" cy="16" r="1" />
            <path d="M13 21C15.5 19.5 17.5 19.5 19.5 20.5" />
            <path d="M15 22.5C17 22 18.5 22.5 20 23.5" />
        </svg>
    );
});

export default BroomIcon;
