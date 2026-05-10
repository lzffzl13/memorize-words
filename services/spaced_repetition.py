from datetime import date, timedelta

def sm2(quality: int, repetitions: int, easiness: float, interval: int):
    """
    SM-2 间隔重复算法。
    quality: 0-5 答题质量（0=完全不会，5=完美）
    返回: (new_repetitions, new_easiness, new_interval)
    """
    if quality >= 3:
        if repetitions == 0:
            new_interval = 1
        elif repetitions == 1:
            new_interval = 6
        else:
            new_interval = round(interval * easiness)
        new_reps = repetitions + 1
    else:
        new_reps = 0
        new_interval = 1

    new_ef = easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)

    return new_reps, new_ef, new_interval


def get_next_review_date(quality: int, repetitions: int, easiness: float, interval: int):
    new_reps, new_ef, new_interval = sm2(quality, repetitions, easiness, interval)
    return date.today() + timedelta(days=new_interval), new_reps, new_ef, new_interval
