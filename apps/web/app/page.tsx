import { loadCourses } from '../lib/content';
import { href } from '../lib/paths';
import { Search } from './search';

export default async function Home() {
  const courses = await loadCourses();
  return (
    <div className="home">
      <header className="course-head">
        <p className="kicker">The library</p>
        <h1>Courses</h1>
        <p className="lede">Each course is planned against an outside exam or standard by code. A course is ready to study when it reaches T4 Examined; until then its tier says how far along it is.</p>
      </header>
      <Search />
      <ul className="course-list">
        {courses.map(({ course, topics }) => (
          <li key={course.id}>
            <a href={href(`/courses/${course.id}/`)}><span className="codes">{course.code}</span> {course.title}</a>
            <span className="tier-badge">{course.tier}</span>
            <span className="note">{topics.length} of {course.topics.length} topics drafted</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
