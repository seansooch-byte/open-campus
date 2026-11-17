import { loadCourses } from '../lib/content';
import { Search } from './search';

export default async function Home() {
  const courses = await loadCourses();
  return (
    <div className="home">
      <header className="course-head">
        <p className="kicker">Open Campus · The library</p>
        <h1>Free university courses, built in the open</h1>
        <p className="lede">Each course is planned against an outside exam by code and checked item by item. It is early: every course shows how far along it is, and none is finished yet. <a href="/catalog/">See all 60 majors</a> or read <a href="/about/">what this is</a>.</p>
      </header>
      <Search />
      <h2>Courses</h2>
      <ul className="course-list">
        {courses.map(({ course, topics }) => (
          <li key={course.id}>
            <a href={`/courses/${course.id}/`}><span className="codes">{course.code}</span> {course.title}</a>
            <span className="tier-badge">{course.tier}</span>
            <span className="note">{topics.length} of {course.topics.length} topics drafted</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
