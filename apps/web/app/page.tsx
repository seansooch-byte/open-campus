import { Badge } from '@open-campus/ui';
import { loadCourses, loadSets, loadTopics } from '../lib/content';
import { Search } from './search';

export default async function Home() {
  const [courses, topics, sets] = await Promise.all([loadCourses(), loadTopics(), loadSets()]);
  return (
    <div className="home">
      <header className="course-head">
        <p className="kicker">The library</p>
        <h1>Courses</h1>
        <p className="lede">Each course is planned against an outside exam or standard by code. A course is ready to study when it reaches T4 Examined; until then its tier says how far along it is.</p>
      </header>
      <Search />
      <ul className="course-list">
        {courses.map(({ course }) => (
          <li key={course.id}>
            <a href={`/courses/${course.id}/`}><span className="codes">{course.code}</span> {course.title}</a>
            <span className="tier-badge">{course.tier}</span>
            <span className="note">{course.topics.length} topics</span>
          </li>
        ))}
      </ul>
      {topics.length > 0 && (
        <section>
          <h2>Topics</h2>
          <ul className="plain">
            {topics.map((t) => (
              <li key={`${t.subject}/${t.slug}`}><a href={`/topics/${t.subject}/${t.slug}/`}>{t.frontmatter.title}</a>{' '}
                {t.frontmatter.example && <Badge tone="info">Example</Badge>}{' '}
                {t.deck && <a href={`/cards/${t.subject}/${t.slug}/`}>cards</a>}</li>
            ))}
          </ul>
        </section>
      )}
      {sets.length > 0 && (
        <section>
          <h2>Question sets</h2>
          <ul className="plain">
            {sets.map((s) => <li key={`${s.section}/${s.slug}`}><a href={`/questions/${s.section}/${s.slug}/`}>{s.set.title}</a></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
