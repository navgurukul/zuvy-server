import { db } from '../src/db';
import { zuvyMentorSlotManagement } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

/* ========================================
PREDEFINED PROFILES
======================================== */

const mentorProfiles = [
  {
    title: 'Frontend Engineer',
    bio: 'Frontend Engineer obsessed with pixel-perfect interfaces...',
    expertise: ['React', 'TypeScript', 'CSS Architecture', 'Web Accessibility'],
    pastExperiences: [
      {
        company: 'Razorpay',
        description:
          'Led frontend rebuild and improved performance and UX consistency',
      },
    ],
  },
  {
    title: 'Backend Engineer',
    bio: 'Backend Engineer specializing in high-throughput systems...',
    expertise: ['Node.js', 'PostgreSQL', 'REST APIs', 'System Design'],
    pastExperiences: [
      {
        company: 'Zepto',
        description:
          'Re-architected order management service for scalability and reliability',
      },
    ],
  },
  {
    title: 'Full Stack Developer',
    bio: 'Full Stack Developer who moves fluidly between frontend and backend...',
    expertise: ['Next.js', 'Django', 'MongoDB', 'DevOps Basics'],
    pastExperiences: [
      {
        company: 'Series A SaaS Startup',
        description:
          'Built end-to-end product features across frontend and backend systems',
      },
    ],
  },
  {
    title: 'Mobile Developer (Android)',
    bio: 'Android Developer focused on smooth, battery-efficient apps...',
    expertise: [
      'Kotlin',
      'Jetpack Compose',
      'Firebase',
      'Offline-First Architecture',
    ],
    pastExperiences: [
      {
        company: 'ShareChat',
        description: 'Optimized video feed performance and reduced app latency',
      },
    ],
  },
  {
    title: 'Mobile Developer (iOS)',
    bio: 'iOS Developer who crafts polished, performant apps...',
    expertise: ['Swift', 'SwiftUI', 'CoreData', 'App Store Optimization'],
    pastExperiences: [
      {
        company: 'Cred',
        description:
          'Built rewards redemption flow improving engagement and retention',
      },
    ],
  },
  {
    title: 'DevOps Engineer',
    bio: 'DevOps Engineer bridging development and production stability...',
    expertise: ['Kubernetes', 'CI/CD', 'Terraform', 'AWS'],
    pastExperiences: [
      {
        company: 'Freshworks',
        description:
          'Migrated 40+ microservices to Kubernetes improving deployment efficiency',
      },
    ],
  },
  {
    title: 'Machine Learning Engineer',
    bio: 'ML Engineer turning research prototypes into production systems...',
    expertise: ['Python', 'PyTorch', 'MLOps', 'Feature Engineering'],
    pastExperiences: [
      {
        company: 'Swiggy',
        description:
          'Productionized demand forecasting model improving delivery efficiency',
      },
    ],
  },
  {
    title: 'Data Engineer',
    bio: 'Data Engineer who builds reliable data pipelines...',
    expertise: ['Apache Spark', 'dbt', 'Airflow', 'BigQuery'],
    pastExperiences: [
      {
        company: 'Meesho',
        description:
          'Redesigned core data warehouse improving data reliability and query performance',
      },
    ],
  },
  {
    title: 'Site Reliability Engineer',
    bio: 'SRE focused on keeping systems reliable at scale...',
    expertise: ['Prometheus', 'Grafana', 'Incident Management', 'Linux'],
    pastExperiences: [
      {
        company: 'Paytm',
        description:
          'Established SRE practices and improved system uptime and observability',
      },
    ],
  },
  {
    title: 'Security Engineer',
    bio: 'Security Engineer embedding secure practices across systems...',
    expertise: ['Penetration Testing', 'OWASP', 'IAM', 'Cloud Security'],
    pastExperiences: [
      {
        company: 'Juspay',
        description:
          'Led full security audit and strengthened platform security posture',
      },
    ],
  },
];

/* ========================================
MAIN SCRIPT
======================================== */

async function main() {
  console.log('🔍 Enriching mentor profiles...');

  try {
    const mentors = await db.select().from(zuvyMentorSlotManagement);

    console.log(`Found ${mentors.length} mentors`);

    let profileIndex = 0;

    for (const mentor of mentors) {
      const profile = mentorProfiles[profileIndex % mentorProfiles.length];

      const updatePayload: any = {};

      // title
      if (!mentor.title) {
        updatePayload.title = profile.title;
      }

      // bio
      if (!mentor.bio) {
        updatePayload.bio = profile.bio;
      }

      // expertise (JSONB safe handling)
      let expertise: any = mentor.expertise;

      if (typeof expertise === 'string') {
        try {
          expertise = JSON.parse(expertise);
        } catch {
          expertise = null;
        }
      }

      if (!Array.isArray(expertise) || expertise.length === 0) {
        updatePayload.expertise = profile.expertise;
      }

      // pastExperiences (JSONB safe handling)
      let pastExperiences: any = mentor.pastExperiences;

      if (typeof pastExperiences === 'string') {
        try {
          pastExperiences = JSON.parse(pastExperiences);
        } catch {
          pastExperiences = null;
        }
      }

      if (!Array.isArray(pastExperiences) || pastExperiences.length === 0) {
        updatePayload.pastExperiences = profile.pastExperiences;
      }

      // update only if needed
      if (Object.keys(updatePayload).length > 0) {
        await db
          .update(zuvyMentorSlotManagement)
          .set({
            ...updatePayload,
            updatedAt: new Date(),
          })
          .where(eq(zuvyMentorSlotManagement.id, mentor.id));

        console.log(`✅ Updated mentor ${mentor.mentorUserId}`);
      }

      profileIndex++;
    }

    console.log('🎉 Mentor profile enrichment completed');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

main();
