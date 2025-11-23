import React from 'react';
import TicketCard from './TicketCard';
import AccommodationCard from './AccommodationCard';
import RentalCard from './RentalCard';
import ActivityCard from './ActivityCard';

const ProgramItem = ({ ex, ...props }) => {
    const isFullWidth = ex.type === 'travel' || ex.type === 'accommodation' || ex.type === 'rental';
    const gridClass = isFullWidth ? "col-span-1 md:col-span-2 lg:col-span-3" : "col-span-1";
    
    let Content = ActivityCard;
    if (ex.type === 'travel') Content = TicketCard;
    else if (ex.type === 'accommodation') Content = AccommodationCard;
    else if (ex.type === 'rental') Content = RentalCard;

    return (
        <div className={gridClass}>
            <Content ex={ex} {...props} />
        </div>
    );
};
export default ProgramItem;