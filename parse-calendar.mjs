import { readFileSync } from 'fs';
import moment from 'moment';
import Table from 'cli-table3';
import { execSync } from 'child_process'

const stdout = execSync('./get-calendar-events.sh', {stdio: ['ignore', 'pipe', 'ignore']});
const output = stdout.toString();
const calendarData = JSON.parse(output)
const calendarItems = calendarData.Body.Items;

const args = process.argv.slice(2);
let weeksAgo = 0;
let weeksAgoArg;
if (weeksAgoArg = args.find(arg => arg.startsWith('--weeks-ago='))) {
    console.log({weeksAgoArg});
    [,weeksAgo] = weeksAgoArg.split('=')
}
const firstDay = moment().startOf('week').subtract(weeksAgo, 'week');
const lastDay = moment().startOf('week').subtract(weeksAgo-1, 'week');
console.log({firstDay, lastDay})

const ignoredEvents = readFileSync('ignored-events.txt', { encoding: 'utf8' }).trim().split("\n")
console.log('ignoredEvents', ignoredEvents)

// Loop thru all the events in the API response
// Filter-out the ones that aren't in the correct date-range
// Filter-out the ones that we don't care about
// Store the others in an "events" array
const events = [];
calendarItems.forEach((item) => {
    const start = moment(item.Start);
    if (start >= firstDay && start <= lastDay) {
        console.log('COUNTING', item.Start, item.Subject)
        if (item.IsAllDayEvent) return;
        if (ignoredEvents.some(ignoredSubject => item.Subject.includes(ignoredSubject))) return;
        events.push({
            name: item.Subject,
            day: start.format('ddd Do MMM'),
            start: start.format('hh:mm a'),
            end: moment(item.End).format('hh:mm a'),
            duration: moment.duration(moment(item.End).diff(start)).asHours().toFixed(1),
            category: item.Categories.length > 0 ? item.Categories[0] : '',
        });
    } else {
        console.log('skipping', item.Start, item.Subject)
    }
});

// Create the events table
const eventsTable = new Table({
    head: [
        'Day',
        'Start',
        'End',
        'Duration',
        'Category',
        'Name',
    ],
    colWidths: [
        15,
        10,
        10,
        10,
        35,
        35
    ],
});

// Add events to the table
events.forEach((event) => {
    eventsTable.push([
        event.day,
        event.start,
        event.end,
        event.duration + 'h',
        event.category,
        event.name,
    ]);
});

// Print the events table
console.log(eventsTable.toString());

// Generate the summary table data
let totalHrs = 0;
const summary = events.reduce((acc, event) => {
    if (!acc[event.category]) {
        acc[event.category] = {
            totalEvents: 0,
            totalDuration: 0,
        };
    }

    acc[event.category].totalEvents += 1;
    acc[event.category].totalDuration += parseFloat(event.duration);
    totalHrs += parseFloat(event.duration)

    return acc;
}, {});

// Create the summary table
const summaryTable = new Table({
    head: ['Category', 'Total Events', 'Total Duration'],
    colWidths: [35, 15, 20],
});

// Add summary data to the table
Object.entries(summary).forEach(([category, stats]) => {
    summaryTable.push([
        category,
        stats.totalEvents,
        stats.totalDuration.toFixed(1) + 'h',
    ]);
});

// Print the summary table
console.log(summaryTable.toString());

// Print the total hours
console.log('totalHrs', totalHrs.toFixed(1))
