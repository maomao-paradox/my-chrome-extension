import { blobToBase64, randomSelect } from '@/utils/base';

export async function fetchImageFromAPI(): Promise<string | null> {
	try {
		const sort = randomSelect(['男', '女', '动漫男', '动漫女']);
		const headImageUrl = `https://api.uomg.com/api/rand.avatar?sort=${sort}&format=image`;
		const response = await fetch(headImageUrl, {
			method: 'GET',
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const imageBlob = await response.blob();
		return blobToBase64(imageBlob, 'image/jpeg');
	} catch (error) {
		console.error('获取图片失败:', error);
		return null;
	}
}
